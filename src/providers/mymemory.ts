// MyMemory 机翻 provider。免费、无 key(带 email 可提额到 ~50000 词/天)。
// GET https://api.mymemory.translated.net/get?q=<text>&langpair=<src>|<tgt>&de=<email>
// src/tgt 不能是 'auto'(MyMemory 不支持),需由 router 规范化。

import type { MTProvider, ProviderCtx, MTResult } from './types';
import { QuotaExceededError } from './types';
import { PROVIDERS } from '@/shared/constants';

interface MyMemoryResponse {
  responseData?: { translatedText?: string; match?: number };
  responseStatus?: number;
  responseDetails?: string;
  matches?: unknown[];
}

const BASE = 'https://api.mymemory.translated.net/get';

/** MyMemory 不接受 'auto',用本机嗅探给个兜底源语言 */
function resolveSrc(text: string, src: string): string {
  if (src !== 'auto') return src;
  // 顺序敏感:假名/谚文必须排在汉字前。日文几乎必含汉字,若先查汉字,
  // 日文会被误判成 zh;默认目标恰是 zh 时 s===tgt 短路原样返回,症状就是"没翻译"。
  if (/[぀-ヿ]/.test(text)) return 'ja'; // 平假名 + 片假名
  if (/[가-힣]/.test(text)) return 'ko'; // 谚文
  if (/[Ѐ-ӿ]/.test(text)) return 'ru'; // 西里尔
  if (/[一-鿿]/.test(text)) return 'zh'; // 汉字(假名已先行排除,纯汉字日文仍会误判,启发式局限)
  return 'en';
}

export const mymemoryProvider: MTProvider = {
  id: PROVIDERS.mymemory,

  async translate(text: string, src: string, tgt: string, ctx: ProviderCtx): Promise<MTResult> {
    const s = resolveSrc(text, src);
    if (s === tgt) {
      return { translation: text, providerUsed: this.id };
    }
    const email = ctx.settings.mtApiKeys.mymemoryEmail?.trim();
    const params = new URLSearchParams({
      q: text,
      langpair: `${s}|${tgt}`,
    });
    if (email) params.set('de', email);

    const res = await fetch(`${BASE}?${params.toString()}`, { signal: ctx.signal });
    if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
    const data = (await res.json()) as MyMemoryResponse;

    const details = data.responseDetails ?? '';
    const status = data.responseStatus;
    const translated = data.responseData?.translatedText ?? '';

    // 额度耗尽
    if (
      /ALL AVAILABLE FREE TRANSLATIONS FOR TODAY/i.test(details) ||
      /USED ALL AVAILABLE/i.test(details) ||
      status === 429
    ) {
      throw new QuotaExceededError('MyMemory 今日免费额度已用尽');
    }
    // 有时错误以文本形式混入译文
    if (/MYMEMORY WARNING|INVALID/i.test(translated)) {
      throw new Error(`MyMemory 返回异常:${translated}`);
    }

    return {
      translation: translated || text,
      providerUsed: this.id,
    };
  },

  async test(ctx: ProviderCtx): Promise<MTResult> {
    return this.translate('hello', 'en', 'zh', ctx);
  },
};
