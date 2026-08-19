import type { Bookmark } from '@/shared/types';
import { langLabel } from '@/shared/lang-codes';

interface Props {
  bookmark: Bookmark;
  onJump: (id: string) => void;
  onFlash: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BookmarkItem({ bookmark: b, onJump, onFlash, onDelete }: Props) {
  const dict = b.dictionaryEntry;
  const word = dict?.word ?? b.anchor.exactText.slice(0, 50);
  const isStale = b.status === 'stale';

  return (
    <li className={`item ${isStale ? 'item--stale' : ''}`}>
      <div className="item__main" onClick={() => onJump(b.id)} role="button" tabIndex={0}>
        <div className="item__word">
          {word}
          {dict?.phonetic && <span className="item__phonetic">{dict.phonetic}</span>}
        </div>
        {b.translation && <div className="item__translation">{b.translation}</div>}
        {!b.translation && b.status === 'pending' && <div className="item__pending">翻译中…</div>}
        <div className="item__meta">
          <span>{langLabel(b.sourceLang)} → {langLabel(b.targetLang)}</span>
          {b.providerUsed && <span className="item__provider">{b.providerUsed}</span>}
          {b.detailMode === 'simple' && <span>简单</span>}
          {isStale && <span className="item__stale">已失效</span>}
        </div>
      </div>
      <div className="item__actions">
        <button className="icon-btn" title="定位" onClick={() => onFlash(b.id)}>◎</button>
        <button className="icon-btn icon-btn--danger" title="删除" onClick={() => onDelete(b.id)}>✕</button>
      </div>
    </li>
  );
}
