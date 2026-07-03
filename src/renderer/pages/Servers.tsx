import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Prefs, ServerEntry } from '../../shared/types';
import { DEFAULT_MUTE_HOTKEY } from '../../shared/types';
import { eventToAccelerator } from '../../shared/hotkey-capture';
import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';

export const Servers = () => {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [url, setUrl] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  const refresh = async () => setServers(await window.shell.servers.list());
  useEffect(() => { void refresh(); return window.shell.onServersChanged(refresh); }, []);
  useEffect(() => { void window.shell.locale().then(setLocale); }, []);
  useEffect(() => { void window.shell.prefs.get().then(setPrefs); }, []);

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

  const saveHotkey = async (muteHotkey: string) => {
    await window.shell.prefs.set({ muteHotkey });
    setPrefs(await window.shell.prefs.get());
  };

  const onHotkeyKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Delete') { void saveHotkey(''); return; }
    if (e.key === 'Escape') { e.currentTarget.blur(); return; }
    const accelerator = eventToAccelerator(e);
    if (accelerator) void saveHotkey(accelerator);
  };

  const hotkeyDisplay = prefs === null
    ? ''
    : prefs.muteHotkey.trim() === '' ? t('mute-hotkey-disabled', locale) : prefs.muteHotkey;

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

      <h3>{t('mute-hotkey-label', locale)}</h3>
      <input
        readOnly
        value={hotkeyDisplay}
        onKeyDown={onHotkeyKeyDown}
        placeholder={t('mute-hotkey-hint', locale)}
        title={t('mute-hotkey-hint', locale)}
        style={{ width: 280 }}
      />
      <button onClick={() => void saveHotkey(DEFAULT_MUTE_HOTKEY)}>{t('mute-hotkey-reset', locale)}</button>
    </div>
  );
};
