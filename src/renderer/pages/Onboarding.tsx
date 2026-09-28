import { useEffect, useState } from 'react';
import { t } from '../../shared/i18n/messages';
import type { Locale } from '../../shared/i18n/locales';

export const Onboarding = () => {
  const [url, setUrl] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void window.shell.locale().then(setLocale);
  }, []);

  const onSubmit = async () => {
    setError(null);
    setChecking(true);
    try {
      const v = await window.shell.servers.validateUrl(url);
      if (!v.ok) {
        setError(t(v.reason ?? 'unreachable', locale));
        return;
      }
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
    <div className="app-center">
      <div className="app-card">
        <h1 className="app-section-title">{t('onboarding-title', locale)}</h1>
        <p className="app-muted" style={{ marginTop: 0 }}>
          {t('onboarding-hint', locale)}
        </p>

        <div className="app-field">
          <input
            className="app-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://chat.example.com"
          />
          <button
            className="app-button app-button--primary"
            onClick={onSubmit}
            disabled={checking}
          >
            {checking
              ? t('servers-checking', locale)
              : t('onboarding-connect', locale)}
          </button>
        </div>

        {error && <p className="app-error">{error}</p>}
      </div>
    </div>
  );
};
