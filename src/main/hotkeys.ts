import { globalShortcut } from 'electron';
import { DEFAULT_MUTE_HOTKEY, DEFAULT_OVERLAY_HOTKEY } from '../shared/types';
import { requestVoiceToggle } from './voice-bridge';
import { toggleOverlayVisibility } from './overlay';
import type { createServerStore } from './servers/store';

type Store = ReturnType<typeof createServerStore>;

export type HotkeyRegistrar = {
  register: (accelerator: string, callback: () => void) => boolean;
  unregisterAll: () => void;
};

// '' (or whitespace) = hotkey disabled; non-string values fall back to default.
export const resolveHotkey = (pref: unknown, fallback: string): string | null => {
  if (typeof pref !== 'string') return fallback;
  const trimmed = pref.trim();
  return trimmed === '' ? null : trimmed;
};

export const resolveMuteHotkey = (pref: unknown): string | null =>
  resolveHotkey(pref, DEFAULT_MUTE_HOTKEY);

export const resolveOverlayHotkey = (pref: unknown): string | null =>
  resolveHotkey(pref, DEFAULT_OVERLAY_HOTKEY);

type HotkeyBinding = { accelerator: string | null; onTrigger: () => void };

// Re-applies ALL hotkeys from scratch. `globalShortcut.unregisterAll()` clears
// every binding, so mute and overlay must be re-registered together in one
// pass. Returns false if any enabled accelerator failed to register. Never
// throws.
export const applyHotkeys = (
  bindings: HotkeyBinding[],
  registrar: HotkeyRegistrar
): boolean => {
  registrar.unregisterAll();
  let ok = true;
  for (const { accelerator, onTrigger } of bindings) {
    if (accelerator === null) continue; // disabled on purpose
    try {
      if (!registrar.register(accelerator, onTrigger)) ok = false;
    } catch {
      ok = false;
    }
  }
  return ok;
};

// Called at startup and again whenever a hotkey pref changes.
export const registerHotkeys = (store: Store) => {
  const prefs = store.getPrefs();
  const ok = applyHotkeys(
    [
      {
        accelerator: resolveMuteHotkey(prefs.muteHotkey),
        onTrigger: requestVoiceToggle
      },
      {
        accelerator: resolveOverlayHotkey(prefs.overlayHotkey),
        onTrigger: toggleOverlayVisibility
      }
    ],
    globalShortcut
  );
  if (!ok) console.warn('[hotkeys] a hotkey could not be registered (invalid or taken by another app)');
};

export const unregisterHotkeys = () => globalShortcut.unregisterAll();
