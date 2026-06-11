import { useEffect, useState } from 'react';
import type { ServerEntry } from '../../shared/types';
import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';

export const Servers = () => {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [url, setUrl] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const refresh = async () => setServers(await window.shell.servers.list());
  useEffect(() => { void refresh(); return window.shell.onServersChanged(refresh); }, []);
  useEffect(() => { void window.shell.locale().then(setLocale); }, []);

  const add = async () => {
    setError(null);
    setChecking(true);
    try {
      const v = await window.shell.servers.validateUrl(url);
      if (!v.ok) { setError(t(v.reason ?? 'unreachable', locale)); return; }
      const r = await window.shell.servers.add(url, '');
      if (r.ok) { setUrl(''); } else { setError(t(r.reason ?? 'unreachable', locale)); }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2>Servers</h2>
      <ul>
        {servers.map((s) => (
          <li key={s.id}>
            {s.label || s.url}
            <button onClick={() => window.shell.servers.switchTo(s.id)}>Open</button>
            <button onClick={() => window.shell.servers.remove(s.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://chat.example.com" />
      <button onClick={add} disabled={checking}>{checking ? 'Checking…' : 'Add'}</button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  );
};
