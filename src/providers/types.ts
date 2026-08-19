// 翻译 provider 抽象。每个 provider 实现这个接口。

import type { Settings } from '@/shared/types';

export interface ProviderCtx {
  settings: Settings;
  signal?: AbortSignal;
}

/** 机翻结果 */
export interface MTResult {
  translation: string;
  providerUsed: string;
}

/** 机翻 provider 接口:把文本从 src 翻成 tgt */
export interface MTProvider {
  id: string;
  /** 测试连接(设置页用),用固定示例词 */
  test(ctx: ProviderCtx): Promise<MTResult>;
  /** 翻译。失败抛错,router 决定降级 */
  translate(text: string, src: string, tgt: string, ctx: ProviderCtx): Promise<MTResult>;
}

/** 额度耗尽错误,router 据此冷却/切换 */
export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}
