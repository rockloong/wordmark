import { LANGUAGES } from '@/shared/lang-codes';

interface Props {
  pair: { src: string; tgt: string };
  onChange: (pair: { src: string; tgt: string }) => void;
}

export function LanguagePairSwitcher({ pair, onChange }: Props) {
  return (
    <div className="lang-pair">
      <select value={pair.src} onChange={(e) => onChange({ ...pair, src: e.target.value })}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
      <span className="lang-pair__arrow">→</span>
      <select value={pair.tgt} onChange={(e) => onChange({ ...pair, tgt: e.target.value })}>
        {LANGUAGES.filter((l) => l.code !== 'auto').map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </div>
  );
}
