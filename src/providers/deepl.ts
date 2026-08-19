// DeepL provider。需用户自填 key(免费版 :fx 前缀走 api-free,pro 走 api)。
// POST https://api-free.deepl.com/v2/translate  (或 https://api.deepl.com/v2/translate)
// body: auth_key, text, source_lang?, target_lang, form-urlencoded

import type { MTProvider, ProviderCtx, MTResult } from './types';
import { PROVIDERS } from '@/shared/constants';

interface DeepLResponse {
  translations?: { text: string; detected_source_language?: string }[];
  message?: string;
}

/** DeepL 语言码:取主语言并大写。zh 系只认 ZH(不支持 ZH-CN/ZH-TW 区域变体,
 *  原先 replace('-','') 会把 zh-CN 变成非法的 ZHCN)。EN/PT 的 -US/-GB/-BR 变体同理取主码。 */
function dlLang(code: string): string {
  return code.split('-')[0].toUpperCase();
}

function baseUrl(key: string): string {
  return key.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
}

export const deeplProvider: MTProvider = {
  id: PROVIDERS.deepl,

  async translate(text: string, src: string, tgt: string, ctx: ProviderCtx): Promise<MTResult> {
    const key = ctx.settings.mtApiKeys.deeplKey?.trim();
    if (!key) throw new Error('未配置 DeepL API key');
    const body = new URLSearchParams({
      auth_key: key,
      text,
      target_lang: dlLang(tgt),
    });
    if (src !== 'auto') body.set('source_lang', dlLang(src));

    const res = await fetch(baseUrl(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: ctx.signal,
    });
    if (res.status === 456) throw new Error('DeepL 配额已用尽');
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as DeepLResponse;
      throw new Error(`DeepL HTTP ${res.status}: ${data.message ?? ''}`);
    }
    const data = (await res.json()) as DeepLResponse;
    const translation = data.translations?.map((t) => t.text).join(' ') ?? '';
    return { translation: translation || text, providerUsed: this.id };
  },

  async test(ctx: ProviderCtx): Promise<MTResult> {
    return this.translate('hello', 'en', 'zh', ctx);
  },
};
