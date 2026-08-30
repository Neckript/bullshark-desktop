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
    </div>
  </>
);
