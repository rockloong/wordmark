// onInstalled:写入默认设置 + 工具栏切换侧边栏 + 右键菜单。

import { DEFAULT_SETTINGS, getSettings, saveSettings } from '@/shared/storage';

export function registerInstallHandler(): void {
  chrome.runtime.onInstalled.addListener(async () => {
    const existing = await getSettings();
    if (!existing || Object.keys(existing).length === 0) {
      await saveSettings({ ...DEFAULT_SETTINGS });
    }
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (err) {
      console.error('[Wordmark] setPanelBehavior failed', err);
    }
    try {
      chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
          id: 'wm-add-bookmark',
          title: '添加为翻译书签',
          contexts: ['selection'],
        });
      });
    } catch (err) {
      console.error('[Wordmark] contextMenus failed', err);
    }
  });
}

