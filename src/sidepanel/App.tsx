import { useEffect, useState, useCallback } from 'react';
import type { Bookmark, Settings, UrlIndex } from '@/shared/types';
import { canonicalUrl, urlHashOf } from '@/shared/id';
import { sendMessage, onMessage } from '@/shared/messaging';
import { BookmarkItem } from './components/BookmarkItem';
import { LanguagePairSwitcher } from './components/LanguagePairSwitcher';
import { EmptyState } from './components/EmptyState';

export function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [urlIndex, setUrlIndex] = useState<UrlIndex>({});

  const refreshBookmarks = useCallback(async (url: string) => {
    if (!url) return;
    const list = (await sendMessage('sidepanel', { type: 'GET_BOOKMARKS', url })) as Bookmark[] | undefined;
    setBookmarks(list ?? []);
  }, []);

  const refreshIndex = useCallback(async () => {
    const idx = (await sendMessage('sidepanel', { type: 'GET_ALL_PAGES' })) as UrlIndex | undefined;
    setUrlIndex(idx ?? {});
  }, []);

  // 初始化:拿当前活动 tab 的 URL
  useEffect(() => {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url ? canonicalUrl(tab.url) : '';
      console.log('[Wordmark][diag] sidepanel init', { tabUrl: tab?.url, canonical: url, hasTab: !!tab });
      setCurrentUrl(url);
      const s = (await sendMessage('sidepanel', { type: 'GET_SETTINGS' })) as Settings | undefined;
      setSettings(s ?? null);
      await refreshBookmarks(url);
      await refreshIndex();
    })();
  }, [refreshBookmarks, refreshIndex]);

  // 监听活动 tab 切换 / 页面刷新或导航(需 tabs 权限保证 tab.url 可读)
  useEffect(() => {
    const onActivated = async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url ? canonicalUrl(tab.url) : '';
      setCurrentUrl(url);
      await refreshBookmarks(url);
    };
    const onUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => {
      // 页面加载完成 或 URL/标题变化:刷新侧边栏当前页书签
      if (changeInfo.status === 'complete' || changeInfo.url || changeInfo.title) {
        const url = tab?.url ? canonicalUrl(tab.url) : '';
        if (url) {
          setCurrentUrl(url);
          void refreshBookmarks(url);
          void refreshIndex();
        }
      }
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [refreshBookmarks, refreshIndex]);

  // 监听 storage 变化(后台改了书签就实时刷新)
  useEffect(() => {
    const listener = () => {
      refreshBookmarks(currentUrl);
      refreshIndex();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [currentUrl, refreshBookmarks, refreshIndex]);

  // 监听 background 的 BOOKMARKS_CHANGED 主动通知(双重保障,不依赖 onChanged 时序)
  useEffect(() => {
    const off = onMessage('sidepanel', async (msg) => {
      if (msg.type === 'BOOKMARKS_CHANGED') {
        await refreshBookmarks(currentUrl);
        await refreshIndex();
      }
      return undefined;
    });
    return off;
  }, [currentUrl, refreshBookmarks, refreshIndex]);

  const onJump = (id: string) => sendMessage('sidepanel', { type: 'JUMP_TO_HIGHLIGHT', id });
  const onFlash = (id: string) => sendMessage('sidepanel', { type: 'FLASH_HIGHLIGHT', id });
  const onDelete = async (id: string) => {
    await sendMessage('sidepanel', { type: 'DELETE_BOOKMARK', id, urlHash: urlHashOf(currentUrl) });
    await refreshBookmarks(currentUrl);
    await refreshIndex();
  };
  const onClearAll = async () => {
    if (!currentUrl) return;
    if (!confirm('确定清空本页所有书签?此操作不可撤销。')) return;
    await sendMessage('sidepanel', { type: 'CLEAR_PAGE', url: currentUrl });
    await refreshBookmarks(currentUrl);
    await refreshIndex();
  };

  const onPairChange = async (pair: { src: string; tgt: string }) => {
    const next = { ...settings!, currentUrlPair: pair };
    setSettings(next);
    await sendMessage('sidepanel', { type: 'SAVE_SETTINGS', settings: next });
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Wordmark</h1>
        {settings && (
          <LanguagePairSwitcher
            pair={settings.currentUrlPair ?? { src: settings.defaultSourceLang, tgt: settings.defaultTargetLang }}
            onChange={onPairChange}
          />
        )}
      </header>

      <div className="app__toolbar">
        <span className="app__count">{bookmarks.length} 个书签</span>
        {bookmarks.length > 0 && (
          <button className="btn btn--danger" onClick={onClearAll}>
            一键清空
          </button>
        )}
      </div>

      {bookmarks.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="list">
          {bookmarks.map((b) => (
            <BookmarkItem
              key={b.id}
              bookmark={b}
              onJump={onJump}
              onFlash={onFlash}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}

      {Object.keys(urlIndex).length > 1 && (
        <details className="all-pages">
          <summary>所有页面({Object.keys(urlIndex).length})</summary>
          <ul className="page-list">
            {Object.values(urlIndex).map((entry) => (
              <li key={entry.urlHash} className={entry.url === currentUrl ? 'is-current' : ''}>
                <span className="page-list__title" title={entry.title}>{entry.title || entry.url}</span>
                <span className="page-list__count">{entry.bookmarkCount}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
