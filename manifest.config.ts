import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Wordmark',
  version: '0.1.0',
  description:
    '选中文字创建翻译书签:高亮、权威词典释义、多语言机翻,侧边栏笔记本。Select text to bookmark with translation.',
  minimum_chrome_version: '114', // sidePanel API 地板;Highlight API 需 105
  // tabs:侧边栏需稳定读取活动 tab 的 url(activeTab 仅在用户手势期间临时有效,
  // 页面刷新/导航后失效,会导致侧边栏查不到当前页书签)。
  permissions: ['sidePanel', 'storage', 'tabs', 'activeTab', 'scripting', 'contextMenus'],
  host_permissions: [
    'https://dict.youdao.com/*',
    'https://api.mymemory.translated.net/*',
    'https://api-free.deepl.com/*',
    'https://api.deepl.com/*',
  ],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    // 不设 default_popup → 工具栏点击切换侧边栏(setPanelBehavior.openPanelOnActionClick)
    default_title: 'Wordmark — 打开笔记本',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_page: 'src/options/index.html',
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      css: ['src/content/highlight.css'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['src/content/popup-card.css', 'icons/*'],
      matches: ['<all_urls>'],
    },
  ],
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
});
