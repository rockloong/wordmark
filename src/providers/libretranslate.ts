// LibreTranslate provider。用户自填实例 URL(+可选 key)。开源、可自建。
// POST <url>/translate  body: { q, source, target, api_key? }
// 注意:用户自填的 URL 无法在 manifest host_permissions 枚举,跨源 fetch 可能被拦。
//   若失败,需提示用户在 manifest 增加 host_permission(上架版本文档说明)。

import type { MTProvider, ProviderCtx, MTResult } from './types';
import { PROVIDERS } from '@/shared/constants';

interface LTResponse {
  translatedText?: string;
  error?: string;
}

export const libretranslateProvider: MTProvider = {
  id: PROVIDERS.libretranslate,

  async translate(text: string, src: string, tgt: string, ctx: ProviderCtx): Promise<MTResult> {
    const url = ctx.settings.mtApiKeys.libretranslateUrl?.trim();
    if (!url) throw new Error('未配置 LibreTranslate 实例 URL');
    const key = ctx.settings.mtApiKeys.libretranslateKey?.trim();
    const endpoint = url.replace(/\/$/, '') + '/translate';

    const body: Record<string, unknown> = {
      q: text,
      source: src === 'auto' ? 'auto' : src,
      target: tgt,
      format: 'text',
    };
    if (key) body.api_key = key;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctx.signal,
    });
    if (!res.ok) throw new Error(`LibreTranslate HTTP ${res.status}`);
    const data = (await res.json()) as LTResponse;
    if (data.error) throw new Error(`LibreTranslate: ${data.error}`);
    return { translation: data.translatedText ?? text, providerUsed: this.id };
  },

  async test(ctx: ProviderCtx): Promise<MTResult> {
    return this.translate('hello', 'en', 'zh', ctx);
  },
};
