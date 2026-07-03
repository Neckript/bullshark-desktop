import { globalShortcut } from 'electron';
import { DEFAULT_MUTE_HOTKEY } from '../shared/types';
import { requestVoiceToggle } from './voice-bridge';
import type { createServerStore } from './servers/store';

type Store = ReturnType<typeof createServerStore>;

export type HotkeyRegistrar = {
  register: (accelerator: string, callback: () => void) => boolean;
  unregisterAll: () => void;
};

// '' (or whitespace) = hotkey disabled; non-string values fall back to default.
export const resolveMuteHotkey = (pref: unknown): string | null => {
  if (typeof pref !== 'string') return DEFAULT_MUTE_HOTKEY;
  const trimmed = pref.trim();
  return trimmed === '' ? null : trimmed;
};

// Re-applies the mute hotkey from scratch. Returns false only when an enabled
// accelerator could not be registered (invalid or taken). Never throws.
export const applyMuteHotkey = (
  accelerator: string | null,
  registrar: HotkeyRegistrar,
  onTrigger: () => void
): boolean => {
  registrar.unregisterAll();
  if (accelerator === null) return true; // disabled on purpose
  try {
    return registrar.register(accelerator, onTrigger);
  } catch {
    return false;
  }
};

// Called at startup and again whenever the muteHotkey pref changes.
export const registerHotkeys = (store: Store) => {
  const accelerator = resolveMuteHotkey(store.getPrefs().muteHotkey);
  const ok = applyMuteHotkey(accelerator, globalShortcut, requestVoiceToggle);
  if (!ok) console.warn(`[hotkeys] could not register mute hotkey "${accelerator}" (invalid or taken by another app)`);
};

export const unregisterHotkeys = () => globalShortcut.unregisterAll();
