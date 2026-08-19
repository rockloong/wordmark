import { useState } from 'react';
import type { MtProviderId, Settings } from '@/shared/types';
import { sendMessage } from '@/shared/messaging';

interface Props {
  provider: MtProviderId;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

export function ProviderConfig({ provider, settings, update }: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const keys = settings.mtApiKeys;
  const setKey = (patch: Partial<Settings['mtApiKeys']>) =>
    update({ mtApiKeys: { ...keys, ...patch } });

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = (await sendMessage('options', {
        type: 'TEST_CONNECTION',
        provider,
        config: keys,
      })) as { ok?: boolean; error?: string; sample?: string };
      if (res?.ok) setTestResult(`✓ 连接成功:${res.sample ?? ''}`);
      else setTestResult(`✗ 失败:${res?.error ?? '未知错误'}`);
    } catch (e) {
      setTestResult(`✗ 错误:${String((e as Error)?.message ?? e)}`);
    }
    setTesting(false);
  };

  return (
    <div className="provider-config">
      {provider === 'mymemory' && (
        <Field label="邮箱(可选,提升额度到 ~50000 词/天)">
          <input
            type="email"
            placeholder="you@example.com"
            value={keys.mymemoryEmail ?? ''}
            onChange={(e) => setKey({ mymemoryEmail: e.target.value })}
          />
        </Field>
      )}

      {provider === 'deepl' && (
        <Field label="DeepL API key(免费版以 :fx 结尾)">
          <input
            type="password"
            placeholder="xxxx-xxxx-...-:fx"
            value={keys.deeplKey ?? ''}
            onChange={(e) => setKey({ deeplKey: e.target.value })}
          />
        </Field>
      )}

      {provider === 'libretranslate' && (
        <>
          <Field label="实例 URL">
            <input
              type="url"
              placeholder="https://libretranslate.com 或自建地址"
              value={keys.libretranslateUrl ?? ''}
              onChange={(e) => setKey({ libretranslateUrl: e.target.value })}
            />
          </Field>
          <Field label="API key(可选)">
            <input
              type="password"
              value={keys.libretranslateKey ?? ''}
              onChange={(e) => setKey({ libretranslateKey: e.target.value })}
            />
          </Field>
          <p className="note">
            注意:自填的实例 URL 需在扩展 host_permissions 中放行,否则跨源请求会被拦截。
          </p>
        </>
      )}

      <button className="btn btn--ghost" onClick={test} disabled={testing}>
        {testing ? '测试中…' : '测试连接'}
      </button>
      {testResult && <p className="test-result">{testResult}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}
