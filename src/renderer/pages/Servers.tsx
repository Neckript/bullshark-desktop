import { useEffect, useState } from 'react';
import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';
import { AboutSection } from '../sections/AboutSection';
import { HotkeysSection } from '../sections/HotkeysSection';
import { ServersSection } from '../sections/ServersSection';

type Section = 'servers' | 'hotkeys' | 'about';

const SECTIONS: { id: Section; code: 'nav-servers' | 'nav-hotkeys' | 'nav-about' }[] = [
  { id: 'servers', code: 'nav-servers' },
  { id: 'hotkeys', code: 'nav-hotkeys' },
  { id: 'about', code: 'nav-about' }
];

export const Servers = () => {
  const [locale, setLocale] = useState<Locale>('en');
  const [version, setVersion] = useState('');
  const [section, setSection] = useState<Section>('servers');

  useEffect(() => {
    void window.shell.locale().then(setLocale);
  }, []);
  useEffect(() => {
    void window.shell.version().then(setVersion);
  }, []);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">Bullshark</div>

        <nav className="app-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={
                s.id === section
                  ? 'app-nav-item app-nav-item--active'
                  : 'app-nav-item'
              }
              aria-current={s.id === section ? 'page' : undefined}
              onClick={() => setSection(s.id)}
            >
              {t(s.code, locale)}
            </button>
          ))}
        </nav>

        <div className="app-sidebar-footer">v{version || '—'}</div>
      </aside>

      <main className="app-content">
        {section === 'servers' && <ServersSection locale={locale} />}
        {section === 'hotkeys' && <HotkeysSection locale={locale} />}
        {section === 'about' && (
          <AboutSection locale={locale} version={version} />
        )}
      </main>
    </div>
  );
};
