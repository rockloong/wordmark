// 翻译路由:决定 词典 vs 机翻、聚合结果、读缓存省额度。
//
// 策略(已与用户确认:词典+机翻混合):
//   - 单个英文词 → 查有道词典(中文释义、音标、词性、例句)
//   - 任何文本都再跑一次机翻 → 给目标语言译文
//   - 两者并行(Promise.allSettled),互不阻塞;机翻失败仍存词典
//   - 按 (textHash, src, tgt) 缓存,避免刷新重拉

import { fetchYoudao } from '@/providers/youdao';
import { getMTProvider } from '@/providers';
import { QuotaExceededError } from '@/providers/types';
import { sha1 } from '@/shared/id';
import { CACHE_TTL, PROVIDERS, QUOTA_COOLDOWN } from '@/shared/constants';
import { getCache, setCache } from '@/shared/storage';
import type { NormalizedDictionaryEntry, Settings } from '@/shared/types';

export interface RouteResult {
  dictionaryEntry: NormalizedDictionaryEntry | null;
  translation: string;
  providerUsed?: string;
}

// 额度耗尽后的冷却窗口(进程内)
let quotaUntil = 0;

export async function routeTranslation(
  text: string,
  src: string,
  tgt: string,
  settings: Settings,
): Promise<RouteResult> {
  const trimmed = text.trim();
  if (!trimmed) return { dictionaryEntry: null, translation: '' };

  const textHash = sha1(trimmed);
  const cacheKey = { textHash, src, tgt };

  // 1. 读缓存(<30 天直接用)
  const cached = await getCache(cacheKey.textHash, cacheKey.src, cacheKey.tgt);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return {
      dictionaryEntry: cached.dictionaryEntry ?? null,
      translation: cached.translation ?? '',
      providerUsed: cached.providerUsed,
    };
  }

  // 2. 词典(有道中文释义,仅英文单词) + 机翻(任意)并行
  const dictPromise =
    settings.dictionaryEnabled && (src === 'en' || src === 'auto')
      ? fetchYoudao(trimmed, src).catch(() => null)
      : Promise.resolve(null);

  const mtPromise = runMT(trimmed, src, tgt, settings);

  const [dictEntry, mt] = await Promise.allSettled([dictPromise, mtPromise]);

  const dictionaryEntry =
    dictEntry.status === 'fulfilled' ? (dictEntry.value as NormalizedDictionaryEntry | null) : null;
  const mtResult = mt.status === 'fulfilled' ? mt.value : undefined;

  const result: RouteResult = {
    dictionaryEntry,
    translation: mtResult?.translation ?? '',
    providerUsed: mtResult?.providerUsed,
  };

  // 3. 写缓存(译文或词典任一有值才写)
  if (result.translation || result.dictionaryEntry) {
    await setCache(cacheKey.textHash, cacheKey.src, cacheKey.tgt, {
      dictionaryEntry: result.dictionaryEntry,
      translation: result.translation,
      providerUsed: result.providerUsed,
      fetchedAt: Date.now(),
    });
  }

  return result;
}

async function runMT(
  text: string,
  src: string,
  tgt: string,
  settings: Settings,
): Promise<{ translation: string; providerUsed: string }> {
  // 冷却期内不请求 MyMemory
  if (settings.mtProvider === PROVIDERS.mymemory && Date.now() < quotaUntil) {
    throw new QuotaExceededError('MyMemory 冷却中');
  }
  if (src === tgt) {
    return { translation: text, providerUsed: 'none' };
  }
  const provider = getMTProvider(settings.mtProvider);
  try {
    const r = await provider.translate(text, src, tgt, { settings });
    return { translation: r.translation, providerUsed: r.providerUsed };
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      quotaUntil = Date.now() + QUOTA_COOLDOWN;
    }
    throw err;
  }
}
