import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { OverlayCorner, Prefs, ServerEntry } from '../../shared/types';
import {
  DEFAULT_MUTE_HOTKEY,
  DEFAULT_OVERLAY_HOTKEY,
  OVERLAY_CORNERS
} from '../../shared/types';
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

  const saveOverlayHotkey = async (overlayHotkey: string) => {
    await window.shell.prefs.set({ overlayHotkey });
    setPrefs(await window.shell.prefs.get());
  };

  const onOverlayHotkeyKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Delete') { void saveOverlayHotkey(''); return; }
    if (e.key === 'Escape') { e.currentTarget.blur(); return; }
    const accelerator = eventToAccelerator(e);
    if (accelerator) void saveOverlayHotkey(accelerator);
  };

  const setOverlayPref = async (patch: Partial<Prefs>) => {
    await window.shell.prefs.set(patch);
    setPrefs(await window.shell.prefs.get());
  };

  const overlayHotkeyDisplay = prefs === null
    ? ''
    : prefs.overlayHotkey.trim() === '' ? t('mute-hotkey-disabled', locale) : prefs.overlayHotkey;

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

      <h3>{t('overlay-section', locale)}</h3>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={prefs?.overlayEnabled ?? false}
          onChange={(e) => void setOverlayPref({ overlayEnabled: e.target.checked })}
        />
        {t('overlay-enable', locale)}
      </label>

      <div style={{ marginTop: 8 }}>
        <label>
          {t('overlay-corner-label', locale)}{' '}
          <select
            value={prefs?.overlayCorner ?? 'top-right'}
            onChange={(e) =>
              void setOverlayPref({ overlayCorner: e.target.value as OverlayCorner })
            }
          >
            {OVERLAY_CORNERS.map((corner) => (
              <option key={corner} value={corner}>
                {t(`overlay-corner-${corner}`, locale)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginTop: 8 }}>
        <div>{t('overlay-hotkey-label', locale)}</div>
        <input
          readOnly
          value={overlayHotkeyDisplay}
          onKeyDown={onOverlayHotkeyKeyDown}
          placeholder={t('mute-hotkey-hint', locale)}
          title={t('mute-hotkey-hint', locale)}
          style={{ width: 280 }}
        />
        <button onClick={() => void saveOverlayHotkey(DEFAULT_OVERLAY_HOTKEY)}>
          {t('mute-hotkey-reset', locale)}
        </button>
      </div>
    </div>
  );
};
