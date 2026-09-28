import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { OverlayCorner, Prefs } from '../../shared/types';
import { DEFAULT_OVERLAY_HOTKEY, OVERLAY_CORNERS } from '../../shared/types';
import { eventToAccelerator } from '../../shared/hotkey-capture';
import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';

export const OverlaySection = ({ locale }: { locale: Locale }) => {
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    void window.shell.prefs.get().then(setPrefs);
  }, []);

  const setPref = async (patch: Partial<Prefs>) => {
    await window.shell.prefs.set(patch);
    setPrefs(await window.shell.prefs.get());
  };

  const onHotkeyKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Delete') {
      void setPref({ overlayHotkey: '' });
      return;
    }
    if (e.key === 'Escape') {
      e.currentTarget.blur();
      return;
    }
    const accelerator = eventToAccelerator(e);
    if (accelerator) void setPref({ overlayHotkey: accelerator });
  };

  const hotkeyDisplay =
    prefs === null
      ? ''
      : prefs.overlayHotkey.trim() === ''
        ? t('mute-hotkey-disabled', locale)
        : prefs.overlayHotkey;

  return (
    <>
      <h2 className="app-section-title">{t('overlay-section', locale)}</h2>

      <div className="app-card">
        <label className="app-field">
          <input
            type="checkbox"
            checked={prefs?.overlayEnabled ?? false}
            onChange={(e) => void setPref({ overlayEnabled: e.target.checked })}
          />
          {t('overlay-enable', locale)}
        </label>
      </div>

      <div className="app-card">
        <div className="app-muted">{t('overlay-corner-label', locale)}</div>
        <div className="app-field">
          <select
            className="app-input"
            value={prefs?.overlayCorner ?? 'top-right'}
            onChange={(e) =>
              void setPref({ overlayCorner: e.target.value as OverlayCorner })
            }
          >
            {OVERLAY_CORNERS.map((corner) => (
              <option key={corner} value={corner}>
                {t(`overlay-corner-${corner}`, locale)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="app-card">
        <div className="app-muted">{t('overlay-hotkey-label', locale)}</div>
        <div className="app-field">
          <input
            className="app-input"
            readOnly
            value={hotkeyDisplay}
            onKeyDown={onHotkeyKeyDown}
            placeholder={t('mute-hotkey-hint', locale)}
            title={t('mute-hotkey-hint', locale)}
          />
          <button
            className="app-button"
            onClick={() =>
              void setPref({ overlayHotkey: DEFAULT_OVERLAY_HOTKEY })
            }
          >
            {t('mute-hotkey-reset', locale)}
          </button>
        </div>
      </div>
    </>
  );
};
