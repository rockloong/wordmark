// 类型安全的消息收发助手。用 MessageEnvelope 包裹,带 source 防回环。

import type {
  Message,
  MessageEnvelope,
  MessageSource,
  CreateBookmarkResponse,
} from './types';

function wrap(source: MessageSource, payload: Message): MessageEnvelope {
  return { source, payload };
}

/** content / sidepanel / options -> background(runtime.sendMessage) */
export function sendMessage(source: MessageSource, payload: Message): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(wrap(source, payload), (response) => {
      // 即使成功也可能有 lastError(多个监听器场景),这里吞掉
      const lastErr = chrome.runtime.lastError;
      if (lastErr && !response) {
        reject(new Error(lastErr.message));
        return;
      }
      resolve(response);
    });
  });
}

/** background -> 某个 tab 的 content(tabs.sendMessage) */
export function sendToTab(tabId: number, source: MessageSource, payload: Message): Promise<unknown> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, wrap(source, payload), (response) => {
      // content 无监听器会触发 lastError,这里静默 resolve undefined
      void chrome.runtime.lastError;
      resolve(response);
    });
  });
}

/** background -> 侧边栏/options(runtime 广播,忽略无监听者错误) */
export function broadcastRuntime(source: MessageSource, payload: Message): Promise<unknown> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(wrap(source, payload), () => {
      void chrome.runtime.lastError; // 无监听者会报错,静默
      resolve(undefined);
    });
  });
}

/**
 * 注册消息监听器,返回反注册函数。
 * handler 可返回值(同步)或 Promise(异步),非 undefined 会被作为响应回传。
 */
export function onMessage(
  receiver: MessageSource,
  handler: (msg: Message, sender: chrome.runtime.MessageSender) => unknown,
): () => void {
  const listener = (
    env: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean => {
    const wrapped = env as MessageEnvelope | undefined;
    if (!wrapped || !wrapped.payload || wrapped.source === receiver) {
      return false; // 防回环:忽略自己发出的
    }
    try {
      const result = handler(wrapped.payload, sender);
      if (result instanceof Promise) {
        result.then(
          (v) => sendResponse(v),
          (err) => sendResponse({ ok: false, error: String(err?.message ?? err) }),
        );
        return true; // 异步,保持 channel 开放
      }
      if (result !== undefined) sendResponse(result);
    } catch (err) {
      sendResponse({ ok: false, error: String((err as Error)?.message ?? err) });
    }
    return false;
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

/** 创建书签的便捷封装:返回带类型的响应 */
export async function requestCreateBookmark(
  source: MessageSource,
  payload: Extract<Message, { type: 'CREATE_BOOKMARK' }>,
): Promise<CreateBookmarkResponse> {
  const res = (await sendMessage(source, payload)) as CreateBookmarkResponse | undefined;
  return res ?? { ok: false, error: 'no response' };
}
