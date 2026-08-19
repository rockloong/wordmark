// 弹出卡片:absolute 定位,粘在单词旁的文档位置上,随页面滚动一起移动。
// 点高亮命中后弹出;Shadow DOM 隔离样式。

import type { Bookmark, DetailMode } from '@/shared/types';
import { langLabel } from '@/shared/lang-codes';
import { sendMessage } from '@/shared/messaging';
import { colorForPos } from '@/shared/constants';
import { getRange, removeHighlight } from './highlight-engine';

function solidColor(rgba: string): string {
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) return rgba;
  const p = m[1].split(',').map((x) => x.trim());
  return `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
}

const HOST_ID = 'wm-card-host';
let cssText = '';

export function initPopupCard(styleCss: string): void {
  cssText = styleCss;
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeCard(), true);
}

let currentId: string | null = null;

function onDocClick(e: MouseEvent): void {
  const target = e.target as Element | null;
  if (target && target.closest('[data-wm-ui]')) return;
  void openCardAt(e.clientX, e.clientY);
}

async function openCardAt(x: number, y: number): Promise<void> {
  const { bookmarkIdAtPoint } = await import('./hit-test');
  const id = bookmarkIdAtPoint(x, y);
  if (!id) {
    closeCard();
    return;
  }
  const bookmarks = (await sendMessage('content', {
    type: 'GET_BOOKMARKS',
    url: location.href.split('#')[0],
  })) as Bookmark[] | undefined;
  const bookmark = bookmarks?.find((b) => b.id === id);
  if (!bookmark) return;

  currentId = id;
  const range = getRange(id);
  const rect = range ? range.getBoundingClientRect() : new DOMRect(x, y, 0, 0);
  renderCard(bookmark, rect);
}

function renderCard(b: Bookmark, targetRect: DOMRect): void {
  let host = document.getElementById(HOST_ID) as HTMLElement | null;
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-wm-ui', '');
    // absolute:相对文档定位,卡片粘在单词旁,随页面滚动一起移动
    host.style.position = 'absolute';
    host.style.zIndex = '2147483646';
    host.style.left = '0';
    host.style.top = '0';
    host.style.pointerEvents = 'none';
    // 挂到 documentElement(html)而非 body:避免宿主页给 body 设了 position:relative
    // 时改变包含块、导致卡片定位偏移。html 几乎不会被定位,最稳。
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = cssText;
    shadow.appendChild(style);
  }
  const shadow = host.shadowRoot!;
  shadow.querySelectorAll('.card').forEach((n) => n.remove());

  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('data-wm-ui', '');
  card.style.pointerEvents = 'auto';
  card.innerHTML = renderHTML(b);
  shadow.appendChild(card);

  // 定位:文档绝对坐标 = 视口rect + 滚动偏移。卡片贴单词下方。
  const left = Math.max(8, Math.min(targetRect.left + window.scrollX, document.documentElement.scrollWidth - 328));
  const top = targetRect.bottom + window.scrollY + 8;
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;

  // 事件
  card.querySelector('.card__close')?.addEventListener('click', closeCard);
  card.querySelector('.card__delete')?.addEventListener('click', () => deleteBookmark(b));
  card.querySelector('.card__toggle')?.addEventListener('click', () => toggleMode(b));
  card.querySelector('.card__audio')?.addEventListener('click', () => {
    if (b.dictionaryEntry?.audioUrl) new Audio(b.dictionaryEntry.audioUrl).play();
  });
}

function renderHTML(b: Bookmark): string {
  const d = b.dictionaryEntry;
  const word = d?.word ?? b.anchor.exactText.slice(0, 40);
  const pending = b.status === 'pending' || (!b.translation && !d);

  const head = `
    <button class="card__close" title="关闭">×</button>
    <button class="card__delete" title="删除此书签">🗑</button>
    <div class="card__head">
      <span class="card__word">${esc(word)}</span>
      ${d?.phonetic ? `<span class="card__phonetic">${esc(d.phonetic)}</span>` : ''}
      ${d?.audioUrl ? `<button class="card__audio" title="发音">🔊</button>` : ''}
    </div>`;

  const translation = pending
    ? `<div class="card__pending">翻译中…</div>`
    : b.translation
      ? `<div class="card__translation">${esc(b.translation)}</div>`
      : '';

  const meanings =
    d && b.detailMode === 'detailed'
      ? d.meanings
          .map((m) => {
            const c = colorForPos(m.partOfSpeech);
            return `<div class="card__meaning"><div class="card__pos" style="color:${solidColor(c.color)}">${esc(m.partOfSpeech || c.label || '释义')}</div>${m.definitions
              .slice(0, 3)
              .map((def) => `<div class="card__def"><span class="card__def-text">${esc(def.definition)}</span>${def.example ? `<div class="card__example">${esc(def.example)}</div>` : ''}</div>`)
              .join('')}</div>`;
          })
          .join('')
      : d && b.detailMode === 'simple'
        ? `<div class="card__meaning"><div class="card__pos">${esc(d.meanings[0]?.partOfSpeech ?? '')}</div><div class="card__def"><span class="card__def-text">${esc(d.meanings[0]?.definitions[0]?.definition ?? '')}</span></div></div>`
        : '';

  const footer = `<div class="card__footer"><span class="card__provider">${esc(b.providerUsed ?? '')} ${langLabel(b.sourceLang)}→${langLabel(b.targetLang)}</span><button class="card__toggle">${b.detailMode === 'detailed' ? '切换简单' : '切换详细'}</button></div>`;

  return head + translation + meanings + footer;
}

function toggleMode(b: Bookmark): void {
  const next: DetailMode = b.detailMode === 'detailed' ? 'simple' : 'detailed';
  void sendMessage('content', { type: 'UPDATE_BOOKMARK', id: b.id, urlHash: b.urlHash, patch: { detailMode: next } }).then(() => {
    const range = getRange(b.id);
    renderCard({ ...b, detailMode: next }, range ? range.getBoundingClientRect() : new DOMRect(0, 0, 0, 0));
  });
}

async function deleteBookmark(b: Bookmark): Promise<void> {
  await sendMessage('content', { type: 'DELETE_BOOKMARK', id: b.id, urlHash: b.urlHash });
  removeHighlight(b.id);
  closeCard();
}

export function closeCard(): void {
  currentId = null;
  document.getElementById(HOST_ID)?.remove();
}

export function updateCardIfOpen(b: Bookmark): void {
  if (currentId === b.id) {
    const range = getRange(b.id);
    renderCard(b, range ? range.getBoundingClientRect() : new DOMRect(0, 0, 0, 0));
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'));
}
