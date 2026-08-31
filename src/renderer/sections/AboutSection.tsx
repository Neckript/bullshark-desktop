import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';

export const AboutSection = ({
  locale,
  version
}: {
  locale: Locale;
  version: string;
}) => (
  <>
    <h2 className="app-section-title">{t('nav-about', locale)}</h2>

    <div className="app-card">
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Bullshark</div>
      <div className="app-muted">
        {t('about-version', locale)} {version || '—'}
      </div>
      <div className="app-actions">
        <span className="app-muted">{t('about-repository', locale)}</span>
        {/* Codeberg d'abord : c'est le dépôt souverain. GitHub n'est que le
            miroir qui déclenche la CI. */}
        <button
          className="app-button"
          onClick={() => void window.shell.openRepository('codeberg')}
        >
          Codeberg
        </button>
        <button
          className="app-button"
          onClick={() => void window.shell.openRepository('github')}
        >
          GitHub
        </button>
      </div>
    </div>
  </>
);
