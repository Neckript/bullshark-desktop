import { useEffect, useState } from 'react';
import type { SourceDto } from '../../shared/types';
import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';

export const SharePicker = () => {
  const [sources, setSources] = useState<SourceDto[]>([]);
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    void window.shell.locale().then(setLocale);
  }, []);

  useEffect(() => {
    void window.shell.screen.getSources().then(setSources);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void window.shell.screen.cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-content app-content--picker">
      <h2 className="app-section-title">{t('share-picker-title', locale)}</h2>

      <div className="app-grid-sources">
        {sources.map((s) => (
          <button
            key={s.id}
            className="app-source"
            onClick={() => void window.shell.screen.choose(s.id)}
          >
            <img className="app-source-thumb" src={s.thumbnailDataUrl} alt="" />
            <div className="app-source-name">
              {s.appIconDataUrl && (
                <img src={s.appIconDataUrl} alt="" width={16} height={16} />
              )}
              <span>{s.name}</span>
            </div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <button
          className="app-button"
          onClick={() => void window.shell.screen.cancel()}
        >
          {t('share-picker-cancel', locale)}
        </button>
      </div>
    </div>
  );
};
