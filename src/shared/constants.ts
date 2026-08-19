// 全局常量:存储键、高亮配色、provider id

export const STORAGE_KEYS = {
  settings: 'settings',
  // 每个页面的书签:page:<urlHash>
  pagePrefix: 'page:',
  // 轻量目录:侧边栏"所有页面"列表,避免加载每个 PageStore
  urlIndex: 'index:url',
  // 翻译缓存:cache:tr:<textHash>:<src>:<tgt>
  cachePrefix: 'cache:tr:',
} as const;

export const PROVIDERS = {
  mymemory: 'mymemory',
  libretranslate: 'libretranslate',
  deepl: 'deepl',
} as const;

// 按词性自动配色(POS = part of speech)。
// key 为词性前缀(来自词典,如 "adj." "n." "v." );匹配时取首个命中。
export const POS_COLORS: { match: string[]; color: string; label: string }[] = [
  { match: ['v.', 'verb'], color: 'rgba(232, 95, 95, 0.42)', label: '动词' }, // 红
  { match: ['n.', 'noun'], color: 'rgba(66, 153, 225, 0.40)', label: '名词' }, // 蓝
  { match: ['adj.', 'a.', 'adjective'], color: 'rgba(245, 166, 35, 0.42)', label: '形容词' }, // 琥珀
  { match: ['adv.', 'adverb'], color: 'rgba(72, 187, 120, 0.40)', label: '副词' }, // 绿
  { match: ['prep.', 'prep'], color: 'rgba(154, 102, 255, 0.38)', label: '介词' }, // 紫
  { match: ['conj.'], color: 'rgba(236, 121, 169, 0.38)', label: '连词' }, // 粉
  { match: ['pron.'], color: 'rgba(56, 178, 172, 0.38)', label: '代词' }, // 青
  { match: ['num.'], color: 'rgba(0, 0, 0, 0.16)', label: '数词' }, // 灰
  { match: ['interj.', 'int.'], color: 'rgba(237, 137, 54, 0.38)', label: '叹词' }, // 橙
];

export const DEFAULT_POS_COLOR = 'rgba(245, 166, 35, 0.42)'; // 无词性时的兜底色

/** 根据词性返回配色 */
export function colorForPos(pos: string | undefined): { color: string; label: string } {
  if (!pos) return { color: DEFAULT_POS_COLOR, label: '' };
  const lower = pos.toLowerCase();
  for (const entry of POS_COLORS) {
    if (entry.match.some((m) => lower.startsWith(m.toLowerCase()))) {
      return { color: entry.color, label: entry.label };
    }
  }
  return { color: DEFAULT_POS_COLOR, label: '' };
}

// 上下文片段长度(prefix/suffix)
export const CONTEXT_CHARS = 40;

// 翻译缓存有效期(30 天,毫秒)
export const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

// 额度冷却(命中 MyMemory "今日额度用尽" 后冷却 1 小时)
export const QUOTA_COOLDOWN = 60 * 60 * 1000;
