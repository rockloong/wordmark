// 核心数据模型与消息契约。整个项目的底座,其他模块都依赖这里。

// ───────────────────────── 书签状态与模式 ─────────────────────────
export type BookmarkStatus = 'active' | 'stale' | 'pending';
export type DetailMode = 'simple' | 'detailed';

// ───────────────────────── 词典归一化结果 ─────────────────────────
export interface NormalizedDictionaryEntry {
  word: string;
  phonetic?: string; // 音标
  audioUrl?: string; // 发音 URL
  meanings: DictionaryMeaning[];
  source: 'youdao'; // 数据来源
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
}

export interface DictionaryDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
}

// ───────────────────────── 文本锚点(Range 重建) ─────────────────────────
// 高亮引擎(content/anchor.ts)生产,持久化存储;页面重载时据此重建 Range。
export interface AnchorData {
  containerXPath: string; // 公共祖先元素的 XPath(优先 id,回退位置路径)
  startTextNodeIndex: number; // 容器下文本节点序号
  endTextNodeIndex: number;
  startOffset: number; // 起始文本节点内偏移
  endOffset: number;
  exactText: string; // range.toString(),校验+展示
  prefixContext: string; // 选中前 ~40 字
  suffixContext: string; // 选中后 ~40 字
}

// ───────────────────────── 书签 ─────────────────────────
export interface Bookmark {
  id: string; // nanoid;也是高亮名 mark-<id>
  url: string;
  urlHash: string;
  title: string;

  anchor: AnchorData;
  textHash: string; // sha1(exactText),去重+缓存键

  sourceLang: string;
  targetLang: string;
  dictionaryEntry?: NormalizedDictionaryEntry | null;
  translation?: string;
  providerUsed?: string;

  detailMode: DetailMode;
  createdAt: number; // 外部传入(脚本里不能 new Date())
  status: BookmarkStatus;
}

// ───────────────────────── 存储 ─────────────────────────
export interface PageStore {
  url: string;
  urlHash: string;
  title: string;
  bookmarks: Bookmark[];
  updatedAt: number;
}

export interface UrlIndexEntry {
  url: string;
  urlHash: string;
  title: string;
  bookmarkCount: number;
  updatedAt: number;
}
export type UrlIndex = Record<string, UrlIndexEntry>; // urlHash -> entry

export type MtProviderId = 'mymemory' | 'libretranslate' | 'deepl';

export interface Settings {
  defaultSourceLang: string;
  defaultTargetLang: string;
  detailMode: DetailMode;
  mtProvider: MtProviderId;
  mtApiKeys: {
    mymemoryEmail?: string;
    libretranslateUrl?: string;
    libretranslateKey?: string;
    deeplKey?: string;
  };
  dictionaryEnabled: boolean;
  currentUrlPair?: { src: string; tgt: string };
}

export interface TranslationCacheEntry {
  dictionaryEntry?: NormalizedDictionaryEntry | null;
  translation?: string;
  providerUsed?: string;
  fetchedAt: number;
}

// ───────────────────────── 消息契约 ─────────────────────────
// bg <-> content 用 chrome.tabs.sendMessage;sidepanel <-> bg 用 chrome.runtime。
// 每条带 source 防回环。
export type MessageSource = 'content' | 'background' | 'sidepanel' | 'options';

export interface MessageEnvelope<T extends Message = Message> {
  source: MessageSource;
  payload: T;
}

export type Message =
  // content -> background
  | { type: 'CREATE_BOOKMARK'; anchor: AnchorData; text: string; textHash: string; src: string; tgt: string; mode: DetailMode; title: string; url: string }
  // background -> content (单书签广播)
  | { type: 'BOOKMARK_UPDATED'; bookmark: Bookmark }
  | { type: 'BOOKMARK_DELETED'; id: string }
  | { type: 'BOOKMARKS_CLEARED'; urlHash: string }
  // content -> background / sidepanel -> background
  | { type: 'GET_BOOKMARKS'; url: string }
  | { type: 'GET_ALL_PAGES' }
  // sidepanel -> background -> content
  | { type: 'JUMP_TO_HIGHLIGHT'; id: string }
  | { type: 'FLASH_HIGHLIGHT'; id: string }
  | { type: 'DELETE_BOOKMARK'; id: string; urlHash: string }
  | { type: 'CLEAR_PAGE'; url: string }
  | { type: 'UPDATE_BOOKMARK'; id: string; urlHash: string; patch: Partial<Bookmark> }
  // options -> background
  | { type: 'TEST_CONNECTION'; provider: MtProviderId; config: Settings['mtApiKeys'] }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: Settings }
  // background -> content (SPA 导航)
  | { type: 'REBUILD_HIGHLIGHTS' }
  // background -> content(快捷键/右键触发:用当前选区建书签)
  | { type: 'ADD_BOOKMARK' }
  // background -> sidepanel(书签增删后主动通知刷新,不依赖 storage.onChanged 时序)
  | { type: 'BOOKMARKS_CHANGED'; urlHash: string };

// 创建书签的同步响应
export interface CreateBookmarkResponse {
  ok: boolean;
  bookmark?: Bookmark;
  error?: string;
  /** 完全相同的片段已存在,拒绝重复创建 */
  duplicate?: boolean;
  /** 重复时既有的书签 id(content 闪烁它作提示) */
  existingId?: string;
}
