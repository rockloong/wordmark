// Provider registry:按 settings.mtProvider 选取机翻 provider。

import type { MTProvider } from './types';
import type { MtProviderId } from '@/shared/types';
import { PROVIDERS } from '@/shared/constants';
import { mymemoryProvider } from './mymemory';
import { deeplProvider } from './deepl';
import { libretranslateProvider } from './libretranslate';

const REGISTRY: Record<MtProviderId, MTProvider> = {
  [PROVIDERS.mymemory]: mymemoryProvider,
  [PROVIDERS.deepl]: deeplProvider,
  [PROVIDERS.libretranslate]: libretranslateProvider,
};

export function getMTProvider(id: MtProviderId): MTProvider {
  return REGISTRY[id] ?? mymemoryProvider;
}

export { mymemoryProvider, deeplProvider, libretranslateProvider };
