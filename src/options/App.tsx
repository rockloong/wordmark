import { useEffect, useState } from 'react';
import type { DetailMode, MtProviderId, Settings } from '@/shared/types';
import { LANGUAGES } from '@/shared/lang-codes';
import { sendMessage } from '@/shared/messaging';
import { ProviderConfig } from './components/ProviderConfig';

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    sendMessage('options', { type: 'GET_SETTINGS' }).then((res) => {
      setSettings(res as Settings);
    });
  }, []);

  if (!settings) return <div className="app"><p>加载设置中…</p></div>;

  const update = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch });

  const save = async () => {
    setSaving(true);
    await sendMessage('options', { type: 'SAVE_SETTINGS', settings });
    setSaving(false);
    setSavedAt(Date.now());
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Wordmark 设置</h1>
        <p className="app__hint">翻译来源、语言、额度配置</p>
      </header>

      <Section title="默认语言对">
        <Row label="源语言">
          <select
            value={settings.defaultSourceLang}
            onChange={(e) => update({ defaultSourceLang: e.target.value })}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </Row>
        <Row label="目标语言">
          <select
            value={settings.defaultTargetLang}
            onChange={(e) => update({ defaultTargetLang: e.target.value })}
          >
            {LANGUAGES.filter((l) => l.code !== 'auto').map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </Row>
        <Row label="默认展示模式">
          <select
            value={settings.detailMode}
            onChange={(e) => update({ detailMode: e.target.value as DetailMode })}
          >
            <option value="detailed">详细(音标/词性/释义/例句)</option>
            <option value="simple">简单(简短释义)</option>
          </select>
        </Row>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.dictionaryEnabled}
            onChange={(e) => update({ dictionaryEnabled: e.target.checked })}
          />
          启用词典释义(有道词典,免费无 key,仅英文单词)
        </label>
      </Section>

      <Section title="机器翻译来源">
        <p className="app__hint">
          默认 MyMemory 免费(每天约 5000 词)。填入自有 key 可解锁更高额度或更高质量。
        </p>
        <div className="radios">
          {(['mymemory', 'deepl', 'libretranslate'] as MtProviderId[]).map((p) => (
            <label key={p} className="radio">
              <input
                type="radio"
                name="mt"
                checked={settings.mtProvider === p}
                onChange={() => update({ mtProvider: p })}
              />
              {labelFor(p)}
            </label>
          ))}
        </div>

        <ProviderConfig provider={settings.mtProvider} settings={settings} update={update} />
      </Section>

      <div className="actions">
        <button className="btn btn--primary" onClick={save} disabled={saving}>
          {saving ? '保存中…' : '保存设置'}
        </button>
        {savedAt && <span className="saved">已保存</span>}
      </div>
    </div>
  );
}

function labelFor(p: MtProviderId): string {
  return p === 'mymemory' ? 'MyMemory(免费默认)' : p === 'deepl' ? 'DeepL(需 key)' : 'LibreTranslate(自建)';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h2 className="section__title">{title}</h2>
      <div className="section__body">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row">
      <span className="row__label">{label}</span>
      <div className="row__control">{children}</div>
    </div>
  );
}
