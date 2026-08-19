// 标签页变化处理:区分全量重载 vs SPA 路由切换。

import { sendToTab } from '@/shared/messaging';
import type { Message } from '@/shared/types';

/**
 * content_scripts 在全量加载时自动注入。SPA(如 React Router)的 pushState
 * 路由切换不会重新注入脚本,需主动通知 content 重新定位并重建高亮。
 *
 * 判据:changeInfo.url 变化且 status 仍为 'complete'(纯地址栏变化,非重载)。
 */
export function registerTabHandlers(): void {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!tab.url) return;
    // URL 变了但不是 loading(即 SPA 导航)
    if (changeInfo.url && changeInfo.status !== 'loading') {
      const msg: Message = { type: 'REBUILD_HIGHLIGHTS' };
      sendToTab(tabId, 'background', msg).catch(() => {
        // 上下文可能已失效;忽略,content 自身的导航事件兜底
      });
    }
  });
}
