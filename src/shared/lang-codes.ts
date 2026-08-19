// 常用语言码(ISO 639-1,中文带区域变体)。机翻 provider 多用此格式。
// 展示名统一用英文全称(如 Simplified Chinese),侧边栏/设置页/卡片共用 langLabel()。

export interface LangOption {
  code: string;
  label: string;
}

export const LANGUAGES: LangOption[] = [
  { code: 'auto', label: 'Auto Detect' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: 'Chinese' },
  { code: 'zh-CN', label: 'Simplified Chinese' },
  { code: 'zh-TW', label: 'Traditional Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'th', label: 'Thai' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'id', label: 'Indonesian' },
  { code: 'tr', label: 'Turkish' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'uk', label: 'Ukrainian' },
];

export function langLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
