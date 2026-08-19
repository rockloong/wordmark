// 文本锚点:把一个 Range 序列化成可重建的锚点,并能从锚点重建 Range。
// 高风险模块:持久化的关键。
//
// 策略(分层降级):
//   1. containerXPath:公共祖先元素的 XPath(优先 id,回退位置)
//   2. start/end 文本节点序号 + 偏移(精确)
//   3. exactText + prefix/suffix 上下文(模糊,应对文本位移)
//
// 重建时:XPath 定位容器 → 精确索引校验 → 失败则文本搜索 → 全失败返回 null(stale)

import type { AnchorData } from '@/shared/types';
import { CONTEXT_CHARS } from '@/shared/constants';

/** 从 Range 计算锚点 */
export function computeAnchor(range: Range): AnchorData | null {
  const container = nearestElement(range.commonAncestorContainer);
  if (!container || container === document.body || container === document.documentElement) {
    return null; // 跨度太大,放弃
  }

  const containerXPath = buildXPath(container);
  const textNodes = textNodesUnder(container);

  const startIndex = textNodes.indexOf(range.startContainer as Text);
  const endIndex = textNodes.indexOf(range.endContainer as Text);
  if (startIndex < 0 || endIndex < 0) return null;

  const exactText = range.toString();
  const fullText = textNodes.map((n) => n.data).join('');
  const selStart = offsetInConcat(textNodes, startIndex, range.startOffset);
  const selEnd = selStart + exactText.length;
  const prefixContext = fullText.slice(Math.max(0, selStart - CONTEXT_CHARS), selStart);
  const suffixContext = fullText.slice(selEnd, selEnd + CONTEXT_CHARS);

  return {
    containerXPath,
    startTextNodeIndex: startIndex,
    endTextNodeIndex: endIndex,
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    exactText,
    prefixContext,
    suffixContext,
  };
}

/** 从锚点重建 Range;失败返回 null(调用方标 stale) */
export function rebuildRange(anchor: AnchorData): Range | null {
  const container = resolveXPath(anchor.containerXPath);
  if (!container) return null;

  const textNodes = textNodesUnder(container);
  return tryExact(textNodes, anchor) ?? tryFuzzySearch(textNodes, anchor);
}

// ───────────────────────── 辅助 ─────────────────────────

function nearestElement(node: Node): HTMLElement | null {
  if (node.nodeType === Node.ELEMENT_NODE) return node as HTMLElement;
  return node.parentElement;
}

/** 收集容器下所有文本节点(排除 script/style) */
export function textNodesUnder(root: Node): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node as Text;
      const parent = text.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
        return NodeFilter.FILTER_REJECT;
      }
      return text.data.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) out.push(n as Text);
  return out;
}

/** 计算 textNode[index]+offset 在拼接字符串中的绝对位置 */
function offsetInConcat(nodes: Text[], index: number, localOffset: number): number {
  let abs = 0;
  for (let i = 0; i < index; i++) abs += nodes[i].data.length;
  return abs + localOffset;
}

/** 构建 XPath:优先 id,否则用位置路径(必须含 /html,document.evaluate 绝对路径需从 html 起) */
function buildXPath(el: HTMLElement): string {
  if (el.id) return `//*[@id="${cssEscape(el.id)}"]`;

  const parts: string[] = [];
  let cur: Element | null = el;
  // 包含 documentElement(html),否则路径缺根导致 document.evaluate 求值失败
  while (cur && cur.nodeType === Node.ELEMENT_NODE && cur.parentElement) {
    const current: Element = cur;
    let part = current.tagName.toLowerCase();
    const parent = current.parentElement!;
    const siblings = Array.from(parent.children).filter((c) => c.tagName === current.tagName);
    if (siblings.length > 1) {
      const idx = siblings.indexOf(current) + 1;
      part += `[${idx}]`;
    }
    parts.unshift(part);
    cur = parent;
  }
  // 最顶层节点(html)无 parentElement 时也加入
  if (cur && cur.nodeType === Node.ELEMENT_NODE) {
    parts.unshift(cur.tagName.toLowerCase());
  }
  return '/' + parts.join('/');
}

function cssEscape(s: string): string {
  // XPath 字符串里 " 需转义;id 基本是安全的,保守处理
  return s.replace(/"/g, '\\"');
}

function resolveXPath(xpath: string): HTMLElement | null {
  // 优先用 id(buildXPath 生成的格式 //*[@id="..."])
  const idMatch = xpath.match(/^\/\/\*\[@id="(.*)"\]$/);
  if (idMatch) {
    return document.getElementById(idMatch[1].replace(/\\"/g, '"'));
  }
  // 位置 XPath
  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  const node = result.singleNodeValue;
  return node && node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : null;
}

function tryExact(textNodes: Text[], anchor: AnchorData): Range | null {
  const start = textNodes[anchor.startTextNodeIndex];
  const end = textNodes[anchor.endTextNodeIndex];
  if (!start || !end) return null;
  // 校验首尾片段
  const head = start.data.slice(anchor.startOffset, anchor.startOffset + Math.min(8, anchor.exactText.length));
  if (!anchor.exactText.startsWith(head) && head.length > 0) return null;

  try {
    const range = document.createRange();
    range.setStart(start, anchor.startOffset);
    range.setEnd(end, anchor.endOffset);
    // 全文校验
    if (range.toString() === anchor.exactText) return range;
    return null;
  } catch {
    return null;
  }
}

function tryFuzzySearch(textNodes: Text[], anchor: AnchorData): Range | null {
  const full = textNodes.map((n) => n.data).join('');
  const needle = anchor.exactText;
  if (!needle || !full.includes(needle)) return null;

  // 找所有出现位置,用 prefix/suffix 评分挑最像的
  let bestStart = -1;
  let bestScore = -1;
  let from = 0;
  while (from <= full.length) {
    const idx = full.indexOf(needle, from);
    if (idx < 0) break;
    const prefix = full.slice(Math.max(0, idx - anchor.prefixContext.length), idx);
    const suffix = full.slice(idx + needle.length, idx + needle.length + anchor.suffixContext.length);
    let score = 0;
    if (prefix === anchor.prefixContext) score += 2;
    else if (prefix.endsWith(anchor.prefixContext.slice(-12))) score += 1;
    if (suffix === anchor.suffixContext) score += 2;
    else if (suffix.startsWith(anchor.suffixContext.slice(0, 12))) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestStart = idx;
    }
    from = idx + 1;
  }
  if (bestStart < 0 || bestScore <= 0) return null;

  // 把绝对位置映射回 (textNode, offset)
  const start = locate(textNodes, bestStart);
  const end = locate(textNodes, bestStart + needle.length);
  if (!start || !end) return null;
  try {
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return range;
  } catch {
    return null;
  }
}

function locate(nodes: Text[], absPos: number): { node: Text; offset: number } | null {
  let acc = 0;
  for (const n of nodes) {
    const len = n.data.length;
    if (acc + len >= absPos) {
      return { node: n, offset: Math.min(absPos - acc, len) };
    }
    acc += len;
  }
  return null;
}
