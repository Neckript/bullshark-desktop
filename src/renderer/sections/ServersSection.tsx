import { useEffect, useState } from 'react';
import type { ServerEntry } from '../../shared/types';
import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';

export const ServersSection = ({ locale }: { locale: Locale }) => {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const refresh = async () => setServers(await window.shell.servers.list());
  useEffect(() => {
    void refresh();
    return window.shell.onServersChanged(refresh);
  }, []);

  const add = async () => {
    setError(null);
    setChecking(true);
    try {
      const v = await window.shell.servers.validateUrl(url);
      if (!v.ok) {
        setError(t(v.reason ?? 'unreachable', locale));
        return;
      }
      const r = await window.shell.servers.add(url, '');
      if (r.ok) setUrl('');
      else setError(t(r.reason ?? 'unreachable', locale));
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <h2 className="app-section-title">{t('nav-servers', locale)}</h2>

      {servers.length === 0 && (
        <p className="app-muted">{t('servers-empty', locale)}</p>
      )}

      {servers.map((s) => (
        <div key={s.id} className="app-card app-row">
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.label || s.url}
          </span>
          <button
            className="app-button"
            onClick={() => window.shell.servers.switchTo(s.id)}
          >
            {t('servers-open', locale)}
          </button>
          <button
            className="app-button app-button--danger"
            onClick={() => window.shell.servers.remove(s.id)}
          >
            {t('servers-remove', locale)}
          </button>
        </div>
      ))}

      <div className="app-field">
        <input
          className="app-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://chat.example.com"
        />
        <button
          className="app-button app-button--primary"
          onClick={add}
          disabled={checking}
        >
          {checking ? t('servers-checking', locale) : t('servers-add', locale)}
        </button>
      </div>

      {error && <p className="app-error">{error}</p>}
    </>
  );
};
