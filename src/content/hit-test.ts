// 命中检测:给定指针坐标,找出它落在哪个书签的高亮 Range 上。
// CSS Custom Highlight 不可交互,只能在 document 上监听事件 + 用 caretPositionFromPoint
// 算出指针下的文本位置,再用 range.isPointInRange 判断属于哪个书签。

import { activeIds, getRange } from './highlight-engine';

/** 返回指针下的书签 id(重叠时取文本最短/最内层的);无则 null */
export function bookmarkIdAtPoint(x: number, y: number): string | null {
  const point = caretAtPoint(x, y);
  if (!point) return null;

  // 收集所有命中的书签,取文本最短者:如先标 "linglong" 再标 "ling",
  // 点 "ling" 区两者都命中,短的 "ling" 才是用户想点的;点 "long" 区只有长条命中。
  // 同长并列时取后注册的(新标的优先)。activeIds() 即注册顺序。
  let hit: string | null = null;
  let hitLen = Infinity;
  for (const id of activeIds()) {
    const range = getRange(id);
    if (!range) continue;
    if (!isPointInRange(range, point.node, point.offset)) continue;
    const len = range.toString().length;
    if (len <= hitLen) {
      hit = id;
      hitLen = len;
    }
  }
  return hit;
}

interface CaretPoint {
  node: Node;
  offset: number;
}

function caretAtPoint(x: number, y: number): CaretPoint | null {
  // 标准 API
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => CaretPositionish | null;
  };
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos && pos.offsetNode) {
      return { node: pos.offsetNode, offset: pos.offset };
    }
  }
  // WebKit/旧版回退
  const docAny = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (typeof docAny.caretRangeFromPoint === 'function') {
    const r = docAny.caretRangeFromPoint(x, y);
    if (r) return { node: r.startContainer, offset: r.startOffset };
  }
  return null;
}

interface CaretPositionish {
  offsetNode: Node;
  offset: number;
}

function isPointInRange(range: Range, node: Node, offset: number): boolean {
  try {
    return range.isPointInRange(node, offset);
  } catch {
    return false;
  }
}
