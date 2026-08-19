// 高亮引擎:用 CSS Custom Highlight API 对 Range 着色,不碰 DOM。
// 重叠天然支持:每个书签一个 ::highlight(name),priority 决定重叠区颜色。
// 每个书签可指定独立颜色(按词性自动配色)。

import { DEFAULT_POS_COLOR } from '@/shared/constants';

const STYLE_ID = 'wm-dynamic-highlights';

// 内存表:id -> { range, priority, color }
interface HLEntry {
  range: Range;
  priority: number;
  color: string;
}
const registry = new Map<string, HLEntry>();

export function isHighlightSupported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS;
}

/** 注册一个书签的高亮。color 用词性配色,priority 越大越在上层 */
export function registerHighlight(id: string, range: Range, color?: string, priority = 0): void {
  if (!isHighlightSupported()) return;
  const hlColor = color || DEFAULT_POS_COLOR;
  const hl = new Highlight(range);
  hl.priority = priority;
  try {
    hl.type = 'highlight';
  } catch {
    /* 老版本无 type,忽略 */
  }
  CSS.highlights.set(highlightName(id), hl);
  registry.set(id, { range, priority, color: hlColor });
  emitStyleRule(id);
}

/** 移除一个高亮 */
export function removeHighlight(id: string): void {
  if (!isHighlightSupported()) return;
  CSS.highlights.delete(highlightName(id));
  registry.delete(id);
  emitStyleRule(id); // 覆盖成空规则
}

/** 闪烁高亮(跳转用):临时提高 priority + 颜色,一段时间后恢复 */
export function flashHighlight(id: string, durationMs = 1500): void {
  const entry = registry.get(id);
  if (!entry || !isHighlightSupported()) return;
  const name = highlightName(id);
  const hl = CSS.highlights.get(name);
  if (!hl) return;
  const oldPriority = entry.priority;
  hl.priority = 9999;
  injectFlashRule(name);
  window.setTimeout(() => {
    hl.priority = oldPriority;
    removeFlashRule(name);
  }, durationMs);
}

/** 拿某书签的 Range(命中检测用) */
export function getRange(id: string): Range | undefined {
  return registry.get(id)?.range;
}

/** 当前所有活动书签 id */
export function activeIds(): string[] {
  return Array.from(registry.keys());
}

function highlightName(id: string): string {
  return `wm-mark-${id}`;
}

// ───────────────────────── 动态 CSS ─────────────────────────
// ::highlight(name) 无法用通配符,需为每个 id 发一条规则。
// 维护单个 <style>,增删时整段重写(<100 书签时很廉价)。

function ensureStyleEl(): HTMLStyleElement | null {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.documentElement.appendChild(el);
  }
  return el;
}

function emitStyleRule(_id: string): void {
  // 仅更新该 id 的规则存在性;简单起见整段重写
  refreshStyle();
}

function refreshStyle(): void {
  const el = ensureStyleEl();
  if (!el) return;
  const rules: string[] = [];
  for (const [id, entry] of registry) {
    rules.push(`::highlight(${highlightName(id)}){background-color:${entry.color};}`);
  }
  el.textContent = rules.join('\n');
}

const FLASH_STYLE_ID = 'wm-flash-highlights';
function injectFlashRule(name: string): void {
  let el = document.getElementById(FLASH_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = FLASH_STYLE_ID;
    document.documentElement.appendChild(el);
  }
  // 追加(不覆盖已有),用 !important 压过普通规则
  el.textContent += `\n::highlight(${name}){background-color:#4299e1!important;}`;
}
function removeFlashRule(name: string): void {
  const el = document.getElementById(FLASH_STYLE_ID) as HTMLStyleElement | null;
  if (!el) return;
  // 移除该 name 的规则行
  const re = new RegExp(`\\n?::highlight\\(${name}\\)\\{[^}]*\\}`, 'g');
  el.textContent = el.textContent.replace(re, '');
  if (!el.textContent.trim()) el.remove();
}

/** 重建时清空内存表(不删 storage,只重置本页高亮注册) */
export function clearInMemory(): void {
  if (isHighlightSupported()) {
    // 只删自己的高亮,避免清掉页面其他用途的
    for (const id of registry.keys()) {
      CSS.highlights.delete(highlightName(id));
    }
  }
  registry.clear();
  const el = document.getElementById(STYLE_ID);
  if (el) el.textContent = '';
}
