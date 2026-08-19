// 内容脚本入口:选词 → 建书签 → 高亮;接收 background 的翻译回补/删除/清空。
// 触发方式:仅 右键菜单「添加为翻译书签」(最稳定,无系统冲突)。

import { computeAnchor, rebuildRange } from './anchor';
import {
  isHighlightSupported,
  registerHighlight,
  removeHighlight,
  flashHighlight,
  getRange,
  clearInMemory,
} from './highlight-engine';
import { onMessage, sendMessage, requestCreateBookmark } from '@/shared/messaging';
import type { Bookmark, Settings } from '@/shared/types';
import { sha1, canonicalUrl } from '@/shared/id';
import { colorForPos } from '@/shared/constants';
import cardCss from './popup-card.css?raw';
import { initPopupCard, closeCard, updateCardIfOpen } from './popup-card';

type SettingsLike = Pick<Settings, 'defaultSourceLang' | 'defaultTargetLang' | 'detailMode' | 'currentUrlPair'>;

const supported = isHighlightSupported();
console.log('[Wordmark] content loaded, highlight supported:', supported);

// ─── 启动:初始化卡片 + 重建已存书签高亮 ───
initPopupCard(cardCss);
rebuildAll();

async function rebuildAll(): Promise<void> {
  if (!supported) {
    console.warn('[Wordmark] CSS Custom Highlight 不支持,无法重建高亮');
    return;
  }
  clearInMemory();
  const url = canonicalUrl(location.href);
  const bookmarks = (await sendMessage('content', { type: 'GET_BOOKMARKS', url })) as Bookmark[] | undefined;
  console.log('[Wordmark] rebuildAll: 从 storage 取到', bookmarks?.length ?? 0, '个书签 @', url);

  if (!bookmarks || bookmarks.length === 0) return;

  let ok = 0;
  const failed: Bookmark[] = [];
  for (const b of bookmarks) {
    const range = rebuildRange(b.anchor);
    if (range) {
      registerHighlight(b.id, range, bookmarkColor(b));
      ok++;
    } else {
      failed.push(b);
      console.warn(
        '[Wordmark] 重建失败(DOM 未就绪或锚点失效):',
        JSON.stringify(b.anchor.exactText.slice(0, 30)),
        'xpath=', b.anchor.containerXPath,
      );
    }
  }
  console.log('[Wordmark] rebuildAll:', ok, '成功,', failed.length, '失败');

  // 异步内容(SPA/AJAX/懒加载):document_idle 时目标文本可能还没出现。
  // 对失败的书签用递增间隔重试,等 DOM 长出来后再定位。
  if (failed.length > 0) retryFailed(failed, [400, 1200, 3000, 6000]);
}

function retryFailed(failed: Bookmark[], delays: number[]): void {
  if (delays.length === 0) {
    console.warn(
      '[Wordmark] 重试耗尽,', failed.length, '个书签无法定位(将标为 stale,保留笔记、丢高亮):',
      failed.map((b) => b.anchor.exactText.slice(0, 24)),
    );
    return;
  }
  const delay = delays[0];
  const rest = delays.slice(1);
  window.setTimeout(() => {
    const still: Bookmark[] = [];
    for (const b of failed) {
      if (getRange(b.id)) continue; // 已被其它途径重建
      const range = rebuildRange(b.anchor);
      if (range) {
        registerHighlight(b.id, range, bookmarkColor(b));
        console.log('[Wordmark] 重试成功:', JSON.stringify(b.anchor.exactText.slice(0, 24)));
      } else {
        still.push(b);
      }
    }
    if (still.length > 0) retryFailed(still, rest);
  }, delay);
}

function bookmarkColor(b: Bookmark): string {
  const pos = b.dictionaryEntry?.meanings?.[0]?.partOfSpeech;
  return colorForPos(pos).color;
}

// ─── 由右键菜单触发:用当前选区创建书签 ───
async function addBookmarkFromSelection(): Promise<void> {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const text = sel.toString().trim();
  if (!text) return;

  closeCard();

  let range: Range;
  try {
    range = sel.getRangeAt(0);
  } catch {
    return;
  }
  const anchor = computeAnchor(range);
  if (!anchor) return;

  const settings = (await sendMessage('content', { type: 'GET_SETTINGS' })) as SettingsLike | undefined;
  const pair = settings?.currentUrlPair;
  const src = pair?.src ?? settings?.defaultSourceLang ?? 'auto';
  const tgt = pair?.tgt ?? settings?.defaultTargetLang ?? 'zh';
  const mode = settings?.detailMode ?? 'detailed';

  const res = await requestCreateBookmark('content', {
    type: 'CREATE_BOOKMARK',
    anchor,
    text,
    textHash: sha1(text),
    src,
    tgt,
    mode,
    title: document.title,
    url: canonicalUrl(location.href),
  });
  if (res.duplicate && res.existingId) {
    // 完全相同的片段已标过:闪烁既有高亮提示,不重复创建
    flashHighlight(res.existingId);
    console.log('[Wordmark] 该片段已有书签,未重复创建:', JSON.stringify(text.slice(0, 24)));
    return;
  }
  if (res.ok && res.bookmark) {
    registerHighlight(res.bookmark.id, range, bookmarkColor(res.bookmark));
  }
}

// ─── 接收 background 消息 ───
onMessage('content', async (msg) => {
  switch (msg.type) {
    case 'ADD_BOOKMARK':
      await addBookmarkFromSelection();
      return;
    case 'BOOKMARK_UPDATED': {
      updateCardIfOpen(msg.bookmark);
      const range = getRange(msg.bookmark.id);
      if (range) registerHighlight(msg.bookmark.id, range, bookmarkColor(msg.bookmark));
      return;
    }
    case 'BOOKMARK_DELETED':
      removeHighlight(msg.id);
      return;
    case 'BOOKMARKS_CLEARED':
      clearInMemory();
      return;
    case 'JUMP_TO_HIGHLIGHT':
      jumpTo(msg.id);
      return;
    case 'FLASH_HIGHLIGHT':
      flashHighlight(msg.id);
      return;
    case 'REBUILD_HIGHLIGHTS':
      await rebuildAll();
      return;
    default:
      return undefined;
  }
});

function jumpTo(id: string): void {
  const range = getRange(id);
  if (!range) return;
  const top = range.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2;
  window.scrollTo({ top, behavior: 'smooth' });
  flashHighlight(id);
}
