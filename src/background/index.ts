// Service Worker 入口:设置初始化、sidePanel 行为、消息路由、书签创建编排。
// 翻译路由细节在 translation-router.ts(M4);这里调用它并广播结果。

import { registerInstallHandler } from './install-handler';
import { registerTabHandlers } from './tab-handlers';
import { onMessage, sendToTab, broadcastRuntime } from '@/shared/messaging';
import { routeTranslation } from './translation-router';
import {
  addBookmark,
  deletePageStore,
  getPageStoreByUrl,
  getSettings,
  removeBookmark,
  saveSettings,
  updateBookmark,
  getUrlIndex,
} from '@/shared/storage';
import { canonicalUrl, newId, urlHashOf } from '@/shared/id';
import type {
  AnchorData,
  Bookmark,
  CreateBookmarkResponse,
  Message,
  Settings,
} from '@/shared/types';
import type { MtProviderId } from '@/shared/types';

console.log('[Wordmark] background service worker loaded');

registerInstallHandler();
registerTabHandlers();
registerMessageRouter();

/** 右键菜单:转发为 ADD_BOOKMARK 给活动 tab 的 content */
function registerContextMenu(): void {
  chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== 'wm-add-bookmark') return;
    const tabId = tab?.id;
    if (tabId) {
      await sendToTab(tabId, 'background', { type: 'ADD_BOOKMARK' }).catch(() => undefined);
    } else {
      await forwardToActiveTab({ type: 'ADD_BOOKMARK' });
    }
  });
}
registerContextMenu();

function registerMessageRouter(): void {
  onMessage('background', async (msg, sender) => {
    switch (msg.type) {
      // ─── 创建书签(乐观:先存,翻译后回补)───
      case 'CREATE_BOOKMARK': {
        // 去重:完全相同的片段(同容器+同首尾定位+同文本)不允许重复标记
        const store = await getPageStoreByUrl(msg.url);
        const dup = store?.bookmarks.find(isSameFragment(msg.anchor));
        if (dup) {
          const resp: CreateBookmarkResponse = {
            ok: false,
            duplicate: true,
            existingId: dup.id,
            error: 'duplicate fragment',
          };
          return resp;
        }

        const createdAt = Date.now();
        const urlHash = urlHashOf(msg.url);
        const bookmark: Bookmark = {
          id: newId(),
          url: canonicalUrl(msg.url),
          urlHash,
          title: msg.title,
          anchor: msg.anchor,
          textHash: msg.textHash,
          sourceLang: msg.src,
          targetLang: msg.tgt,
          dictionaryEntry: null,
          translation: '',
          providerUsed: undefined,
          detailMode: msg.mode,
          createdAt,
          status: 'pending',
        };
        await addBookmark(msg.url, bookmark);
        // 通知侧边栏实时刷新(不依赖 storage.onChanged 时序)
        void broadcastRuntime('background', { type: 'BOOKMARKS_CHANGED', urlHash: bookmark.urlHash });

        // 异步翻译并回补(不阻塞返回)
        translateAndFill(bookmark, sender.tab?.id, msg.text).catch((err) =>
          console.error('[Wordmark] translate failed', err),
        );

        // 同步返回:content 立即高亮(pending)
        const resp: CreateBookmarkResponse = { ok: true, bookmark };
        return resp;
      }

      // ─── 查询书签 ───
      case 'GET_BOOKMARKS': {
        const store = await getPageStoreByUrl(msg.url);
        return store?.bookmarks ?? [];
      }

      case 'GET_ALL_PAGES': {
        return await getUrlIndex();
      }

      // ─── 侧边栏操作 ───
      case 'JUMP_TO_HIGHLIGHT':
      case 'FLASH_HIGHLIGHT': {
        // 侧边栏发起时 sender.tab 为空,需查活动 tab 转发到 content
        await forwardToActiveTab(msg);
        return { ok: true };
      }

      case 'DELETE_BOOKMARK': {
        const updated = await removeBookmark(msg.urlHash, msg.id);
        await forwardToActiveTab({ type: 'BOOKMARK_DELETED', id: msg.id } as Message);
        void broadcastRuntime('background', { type: 'BOOKMARKS_CHANGED', urlHash: msg.urlHash });
        return { ok: true, store: updated };
      }

      case 'CLEAR_PAGE': {
        const urlHash = urlHashOf(msg.url);
        await deletePageStore(urlHash);
        await forwardToActiveTab({ type: 'BOOKMARKS_CLEARED', urlHash } as Message);
        void broadcastRuntime('background', { type: 'BOOKMARKS_CHANGED', urlHash });
        return { ok: true };
      }

      case 'UPDATE_BOOKMARK': {
        const updated = await updateBookmark(msg.urlHash, msg.id, msg.patch);
        if (updated) {
          await forwardToActiveTab({ type: 'BOOKMARK_UPDATED', bookmark: updated } as Message);
          void broadcastRuntime('background', { type: 'BOOKMARKS_CHANGED', urlHash: msg.urlHash });
        }
        return { ok: true, bookmark: updated };
      }

      // ─── 设置 ───
      case 'GET_SETTINGS':
        return await getSettings();

      case 'SAVE_SETTINGS':
        await saveSettings(msg.settings as Settings);
        return { ok: true };

      case 'TEST_CONNECTION':
        return await testConnection(msg.provider, msg.config);

      default:
        return undefined;
    }
  });
}

/** 异步翻译并回补书签,广播给活动 tab 的 content 更新卡片 */
async function translateAndFill(bookmark: Bookmark, tabId: number | undefined, text: string): Promise<void> {
  const settings = await getSettings();
  const result = await routeTranslation(text, bookmark.sourceLang, bookmark.targetLang, settings);
  const patch: Partial<Bookmark> = {
    dictionaryEntry: result.dictionaryEntry,
    translation: result.translation,
    providerUsed: result.providerUsed,
    status: 'active',
  };
  await updateBookmark(bookmark.urlHash, bookmark.id, patch);
  const updated: Bookmark = { ...bookmark, ...patch };

  if (tabId) {
    await sendToTab(tabId, 'background', { type: 'BOOKMARK_UPDATED', bookmark: updated }).catch(
      () => undefined,
    );
  }
}

/** 把消息转发到当前活动 tab(供侧边栏发起的跳转/删除回声) */
async function forwardToActiveTab(msg: Message): Promise<void> {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id) {
    await sendToTab(active.id, 'background', msg).catch(() => undefined);
  }
}

/** 判断书签是否与给定锚点指向完全相同的片段(同容器 XPath + 同首尾节点/偏移 + 同文本)。
 *  同文不同位置(如两处 "ling")偏移不同,不算重复。 */
function isSameFragment(a: AnchorData): (b: Bookmark) => boolean {
  return (b) =>
    b.anchor.containerXPath === a.containerXPath &&
    b.anchor.startTextNodeIndex === a.startTextNodeIndex &&
    b.anchor.endTextNodeIndex === a.endTextNodeIndex &&
    b.anchor.startOffset === a.startOffset &&
    b.anchor.endOffset === a.endOffset &&
    b.anchor.exactText === a.exactText;
}

async function testConnection(provider: MtProviderId, config: Settings['mtApiKeys']): Promise<{ ok: boolean; error?: string; sample?: string }> {
  const result = await routeTranslation('hello', 'en', 'zh', {
    defaultSourceLang: 'auto',
    defaultTargetLang: 'zh',
    detailMode: 'detailed',
    mtProvider: provider,
    mtApiKeys: config,
    dictionaryEnabled: false,
  });
  return { ok: !!result.translation, sample: result.translation };
}
