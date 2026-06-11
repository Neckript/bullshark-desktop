import { useEffect, useState } from 'react';
import { t } from '../../shared/i18n/messages';
import type { Locale } from '../../shared/i18n/locales';

export const Onboarding = () => {
  const [url, setUrl] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => { void window.shell.locale().then(setLocale); }, []);

  const onSubmit = async () => {
    setError(null);
    setChecking(true);
    try {
      const v = await window.shell.servers.validateUrl(url);
      if (!v.ok) { setError(t(v.reason ?? 'unreachable', locale)); return; }
      const res = await window.shell.servers.add(url, '');
      if (res.ok && res.id) {
        await window.shell.servers.switchTo(res.id);
        window.close();
      } else {
        setError(t(res.reason ?? 'unreachable', locale));
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2>Connect to your Bullshark server</h2>
      <p>Enter the URL of your Bullshark instance.</p>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://chat.example.com"
        style={{ width: '100%', padding: 8 }}
      />
      <button onClick={onSubmit} disabled={checking} style={{ marginTop: 12 }}>
        {checking ? 'Checking…' : 'Connect'}
      </button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  );
};
