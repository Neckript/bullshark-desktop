import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Prefs } from '../../shared/types';
import { DEFAULT_MUTE_HOTKEY } from '../../shared/types';
import { eventToAccelerator } from '../../shared/hotkey-capture';
import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';

export const HotkeysSection = ({ locale }: { locale: Locale }) => {
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    void window.shell.prefs.get().then(setPrefs);
  }, []);

  const saveHotkey = async (muteHotkey: string) => {
    await window.shell.prefs.set({ muteHotkey });
    setPrefs(await window.shell.prefs.get());
  };

  const onHotkeyKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Delete') {
      void saveHotkey('');
      return;
    }
    if (e.key === 'Escape') {
      e.currentTarget.blur();
      return;
    }
    const accelerator = eventToAccelerator(e);
    if (accelerator) void saveHotkey(accelerator);
  };

  const hotkeyDisplay =
    prefs === null
      ? ''
      : prefs.muteHotkey.trim() === ''
        ? t('mute-hotkey-disabled', locale)
        : prefs.muteHotkey;

  return (
    <>
      <h2 className="app-section-title">{t('nav-hotkeys', locale)}</h2>

      <div className="app-card">
        <div className="app-muted">{t('mute-hotkey-label', locale)}</div>
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
            onClick={() => void saveHotkey(DEFAULT_MUTE_HOTKEY)}
          >
            {t('mute-hotkey-reset', locale)}
          </button>
        </div>
      </div>
    </>
  );
};
