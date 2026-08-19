// chrome.storage.local 封装。所有持久化都走这里,SW 可被杀也安全。

import {
  STORAGE_KEYS,
} from './constants';
import { canonicalUrl, urlHashOf } from './id';
import type {
  Bookmark,
  PageStore,
  Settings,
  TranslationCacheEntry,
  UrlIndex,
  UrlIndexEntry,
} from './types';

export const DEFAULT_SETTINGS: Settings = {
  defaultSourceLang: 'auto',
  defaultTargetLang: 'zh',
  detailMode: 'detailed',
  mtProvider: 'mymemory',
  mtApiKeys: {},
  dictionaryEnabled: true,
};

function pageKey(urlHash: string): string {
  return STORAGE_KEYS.pagePrefix + urlHash;
}
function cacheKey(textHash: string, src: string, tgt: string): string {
  return `${STORAGE_KEYS.cachePrefix}${textHash}:${src}:${tgt}`;
}

// ───────────────────────── Settings ─────────────────────────
export async function getSettings(): Promise<Settings> {
  const raw = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const stored = raw[STORAGE_KEYS.settings] as Partial<Settings> | undefined;
  // 合并默认值,防止旧版本缺字段
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    mtApiKeys: { ...stored?.mtApiKeys },
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

// ───────────────────────── PageStore ─────────────────────────
export async function getPageStore(urlOrHash: string): Promise<PageStore | null> {
  const key = urlOrHash.includes(':') ? urlOrHash : pageKey(urlOrHash);
  const raw = await chrome.storage.local.get(key);
  return (raw[key] as PageStore | undefined) ?? null;
}

export async function getPageStoreByUrl(url: string): Promise<PageStore | null> {
  return getPageStore(pageKey(urlHashOf(url)));
}

export async function savePageStore(store: PageStore): Promise<void> {
  await chrome.storage.local.set({ [pageKey(store.urlHash)]: store });
  await touchUrlIndex(store);
}

export async function deletePageStore(urlHash: string): Promise<void> {
  await chrome.storage.local.remove(pageKey(urlHash));
  await removeFromUrlIndex(urlHash);
}

// ───────────────────────── 书签增删 ─────────────────────────
export async function addBookmark(url: string, bookmark: Bookmark): Promise<PageStore> {
  const urlHash = urlHashOf(url);
  const store = (await getPageStore(pageKey(urlHash))) ?? {
    url: canonicalUrl(url),
    urlHash,
    title: bookmark.title,
    bookmarks: [],
    updatedAt: 0,
  };
  // 替换同 id(幂等),否则追加
  const idx = store.bookmarks.findIndex((b) => b.id === bookmark.id);
  if (idx >= 0) store.bookmarks[idx] = bookmark;
  else store.bookmarks.push(bookmark);
  store.title = bookmark.title || store.title;
  store.updatedAt = bookmark.createdAt;
  await savePageStore(store);
  return store;
}

export async function removeBookmark(urlHash: string, id: string): Promise<PageStore | null> {
  const store = await getPageStore(pageKey(urlHash));
  if (!store) return null;
  store.bookmarks = store.bookmarks.filter((b) => b.id !== id);
  store.updatedAt = Date.now();
  if (store.bookmarks.length === 0) {
    await deletePageStore(urlHash);
    return null;
  }
  await savePageStore(store);
  return store;
}

export async function updateBookmark(
  urlHash: string,
  id: string,
  patch: Partial<Bookmark>,
): Promise<Bookmark | null> {
  const store = await getPageStore(pageKey(urlHash));
  if (!store) return null;
  const b = store.bookmarks.find((x) => x.id === id);
  if (!b) return null;
  Object.assign(b, patch);
  store.updatedAt = Date.now();
  await savePageStore(store);
  return b;
}

// ───────────────────────── URL 目录(侧边栏"所有页面") ─────────────────────────
export async function getUrlIndex(): Promise<UrlIndex> {
  const raw = await chrome.storage.local.get(STORAGE_KEYS.urlIndex);
  return (raw[STORAGE_KEYS.urlIndex] as UrlIndex | undefined) ?? {};
}

async function touchUrlIndex(store: PageStore): Promise<void> {
  const idx = await getUrlIndex();
  const entry: UrlIndexEntry = {
    url: store.url,
    urlHash: store.urlHash,
    title: store.title,
    bookmarkCount: store.bookmarks.length,
    updatedAt: store.updatedAt,
  };
  idx[store.urlHash] = entry;
  await chrome.storage.local.set({ [STORAGE_KEYS.urlIndex]: idx });
}

async function removeFromUrlIndex(urlHash: string): Promise<void> {
  const idx = await getUrlIndex();
  if (urlHash in idx) {
    delete idx[urlHash];
    await chrome.storage.local.set({ [STORAGE_KEYS.urlIndex]: idx });
  }
}

// ───────────────────────── 翻译缓存 ─────────────────────────
export async function getCache(
  textHash: string,
  src: string,
  tgt: string,
): Promise<TranslationCacheEntry | null> {
  const key = cacheKey(textHash, src, tgt);
  const raw = await chrome.storage.local.get(key);
  return (raw[key] as TranslationCacheEntry | undefined) ?? null;
}

export async function setCache(
  textHash: string,
  src: string,
  tgt: string,
  entry: TranslationCacheEntry,
): Promise<void> {
  const key = cacheKey(textHash, src, tgt);
  await chrome.storage.local.set({ [key]: entry });
}
