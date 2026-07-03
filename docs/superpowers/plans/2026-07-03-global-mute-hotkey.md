# Global Mute Hotkey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A global OS-level mute/unmute hotkey (default `CommandOrControl+Shift+M`, configurable in the Servers window) that works while a game has focus, wired end-to-end through the existing-but-dormant desktop voice bridge into the web client.

**Architecture:** Desktop main registers an Electron `globalShortcut` that fires the existing `requestVoiceToggle()`; the web client gains a `use-desktop-bridge` hook in `VoiceProvider` that consumes the already-exposed `window.bullshark.voice` preload API (`onToggleRequest` → `toggleMic()`, state changes → `reportState()`), which also activates the currently-inert tray microphone toggle and `mic-muted` tray icon. The mute/unmute beep already exists inside `toggleMic()` (`use-voice-controls.ts`), so no cue code is needed.

**Tech Stack:** Electron 3x (`globalShortcut`), electron-vite, React 19, vitest (desktop repo only), Bun workspaces (client repo).

**Spec:** `docs/superpowers/specs/2026-07-03-global-mute-hotkey-design.md`

## Global Constraints

- Two repos: **bullshark-desktop** at `C:\Users\Neckr\Documents\bullshark-desktop` (Tasks 1–5), **bullshark** at `C:\Users\Neckr\Documents\bullshark` (Task 6). Work on the `development` branch in both.
- No new dependencies in either repo.
- Default accelerator is exactly `CommandOrControl+Shift+M`; empty-string pref = hotkey disabled.
- Desktop i18n: every new message code needs all 7 locales (en, fr, es, it, ru, zh, cs) — `messages.test.ts` enforces this automatically.
- Desktop repo commands: `npm test` (vitest), `npm run typecheck`, `npm run lint`. Client repo commands (run from repo root `C:\Users\Neckr\Documents\bullshark`): `bun run check-types`, `bun run lint`.
- The client must remain a full no-op in a plain browser (`window.bullshark` absent) and must not break against an older desktop app.
- Never crash or block startup on an invalid/taken accelerator — warn and continue.

---

### Task 1: Desktop — `muteHotkey` pref with defaults merge

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/servers/store.ts:12`
- Test: `src/main/servers/store.test.ts`

**Interfaces:**
- Produces: `Prefs.muteHotkey: string` (required), `DEFAULT_MUTE_HOTKEY = 'CommandOrControl+Shift+M'` exported from `src/shared/types.ts`, and the guarantee that `store.getPrefs()` always returns every `Prefs` key (defaults merged over stored partials).

Today `getPrefs` returns the raw stored object (`backend.get<Prefs>('prefs', { ...DEFAULT_PREFS })`), so prefs stored by an older version would lack `muteHotkey`. Merging defaults fixes this for every future pref too.

- [ ] **Step 1: Write the failing test**

Add to the existing `describe('server store', ...)` block in `src/main/servers/store.test.ts`:

```ts
  test('getPrefs merges defaults over stored partial prefs', () => {
    const backend = memoryBackend();
    // simulate prefs persisted by an older app version (no muteHotkey)
    backend.set('prefs', { activeServerId: null, notificationsMuted: true });
    const s = createServerStore(backend);
    expect(s.getPrefs().muteHotkey).toBe(DEFAULT_MUTE_HOTKEY);
    expect(s.getPrefs().notificationsMuted).toBe(true);
  });
```

Add to the imports at the top of the file:

```ts
import { DEFAULT_MUTE_HOTKEY } from '../../shared/types';
```

Note: `memoryBackend()` already exists at the top of this test file; the new test creates its own backend instance instead of using the shared `beforeEach` store.

- [ ] **Step 2: Run test to verify it fails**

Run (in `bullshark-desktop`): `npm test -- store`
Expected: FAIL — `DEFAULT_MUTE_HOTKEY` has no exported member / `muteHotkey` does not exist on type `Prefs`.

- [ ] **Step 3: Implement**

In `src/shared/types.ts`, replace the `Prefs` type and `DEFAULT_PREFS`:

```ts
export const DEFAULT_MUTE_HOTKEY = 'CommandOrControl+Shift+M';

export type Prefs = {
  activeServerId: string | null;
  notificationsMuted: boolean;
  launchOnStartup: boolean;
  lastWindowBounds: { width: number; height: number; x?: number; y?: number } | null;
  muteHotkey: string; // Electron accelerator; '' = hotkey disabled
};

export const DEFAULT_PREFS: Prefs = {
  activeServerId: null,
  notificationsMuted: false,
  launchOnStartup: false,
  lastWindowBounds: null,
  muteHotkey: DEFAULT_MUTE_HOTKEY
};
```

In `src/main/servers/store.ts`, replace line 12:

```ts
  const getPrefs = (): Prefs => ({ ...DEFAULT_PREFS, ...backend.get<Partial<Prefs>>('prefs', {}) });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` then `npm run typecheck`
Expected: all tests PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/main/servers/store.ts src/main/servers/store.test.ts
git commit -m "feat: add muteHotkey pref with defaults merge in getPrefs"
```

---

### Task 2: Desktop — hotkeys module

**Files:**
- Create: `src/main/hotkeys.ts`
- Modify: `src/test/electron-stub.ts`
- Test: `src/main/hotkeys.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_MUTE_HOTKEY` from `src/shared/types` (Task 1), `requestVoiceToggle` from `./voice-bridge` (existing).
- Produces: `resolveMuteHotkey(pref: unknown): string | null`, `applyMuteHotkey(accelerator: string | null, registrar: HotkeyRegistrar, onTrigger: () => void): boolean`, `registerHotkeys(store): void`, `unregisterHotkeys(): void`, `type HotkeyRegistrar = { register(accelerator: string, callback: () => void): boolean; unregisterAll(): void }`.

- [ ] **Step 1: Write the failing tests**

Create `src/main/hotkeys.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { DEFAULT_MUTE_HOTKEY } from '../shared/types';
import { applyMuteHotkey, resolveMuteHotkey, type HotkeyRegistrar } from './hotkeys';

const fakeRegistrar = (registerResult: boolean | 'throw' = true) => {
  const calls: { registered: string[]; unregisterAllCount: number } = { registered: [], unregisterAllCount: 0 };
  const registrar: HotkeyRegistrar = {
    register: (accelerator) => {
      if (registerResult === 'throw') throw new Error('invalid accelerator');
      calls.registered.push(accelerator);
      return registerResult;
    },
    unregisterAll: () => { calls.unregisterAllCount += 1; }
  };
  return { registrar, calls };
};

describe('resolveMuteHotkey', () => {
  test('non-string values fall back to the default', () => {
    expect(resolveMuteHotkey(undefined)).toBe(DEFAULT_MUTE_HOTKEY);
    expect(resolveMuteHotkey(42)).toBe(DEFAULT_MUTE_HOTKEY);
  });
  test('empty or whitespace-only string means disabled (null)', () => {
    expect(resolveMuteHotkey('')).toBeNull();
    expect(resolveMuteHotkey('   ')).toBeNull();
  });
  test('a custom accelerator is returned trimmed', () => {
    expect(resolveMuteHotkey(' Alt+F10 ')).toBe('Alt+F10');
  });
});

describe('applyMuteHotkey', () => {
  test('always clears previous registrations first', () => {
    const { registrar, calls } = fakeRegistrar();
    applyMuteHotkey(null, registrar, () => {});
    expect(calls.unregisterAllCount).toBe(1);
  });
  test('disabled (null) registers nothing and reports success', () => {
    const { registrar, calls } = fakeRegistrar();
    expect(applyMuteHotkey(null, registrar, () => {})).toBe(true);
    expect(calls.registered).toEqual([]);
  });
  test('registers the accelerator and wires the trigger', () => {
    const { registrar, calls } = fakeRegistrar();
    let fired = 0;
    expect(applyMuteHotkey('Alt+M', { ...registrar, register: (a, cb) => { calls.registered.push(a); cb(); fired += 1; return true; } }, () => { fired += 10; })).toBe(true);
    expect(calls.registered).toEqual(['Alt+M']);
    expect(fired).toBe(11); // callback invoked once by the fake, trigger ran
  });
  test('reports failure when registration is refused', () => {
    const { registrar } = fakeRegistrar(false);
    expect(applyMuteHotkey('Alt+M', registrar, () => {})).toBe(false);
  });
  test('reports failure instead of throwing on an invalid accelerator', () => {
    const { registrar } = fakeRegistrar('throw');
    expect(applyMuteHotkey('Not A Key', registrar, () => {})).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- hotkeys`
Expected: FAIL — cannot find module `./hotkeys`.

- [ ] **Step 3: Implement**

Create `src/main/hotkeys.ts`:

```ts
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
```

Add to `src/test/electron-stub.ts` (the vitest alias for `electron`). Both exports are required: `hotkeys.ts` imports `globalShortcut`, and it also imports `./voice-bridge`, which imports `BrowserWindow` — a missing named export would fail the test build:

```ts
export const globalShortcut = { register: () => true, unregisterAll: () => {} };
export const BrowserWindow = { getAllWindows: () => [] as { webContents: { send: (channel: string) => void } }[] };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` then `npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/hotkeys.ts src/main/hotkeys.test.ts src/test/electron-stub.ts
git commit -m "feat: add global mute hotkey registration module"
```

---

### Task 3: Desktop — lifecycle and IPC wiring

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc.ts:26` (allowed prefs) and after `store.setPrefs` (line ~29)

**Interfaces:**
- Consumes: `registerHotkeys(store)`, `unregisterHotkeys()` from `./hotkeys` (Task 2).
- Produces: hotkey active at app startup; changing `muteHotkey` via `IPC.prefsSet` re-registers immediately; all shortcuts released on quit.

No unit test: `index.ts` and `ipc.ts` are thin Electron wiring with no test coverage in this repo (verified: no `ipc.test.ts` exists); behavior is covered by Task 7's manual pass.

- [ ] **Step 1: Wire startup and quit in `src/main/index.ts`**

Add the import:

```ts
import { registerHotkeys, unregisterHotkeys } from './hotkeys';
```

Inside `app.whenReady().then(() => { ... })`, after `initTray(store);` add:

```ts
    registerHotkeys(store);
```

After the `app.on('window-all-closed', ...)` line, add:

```ts
  app.on('will-quit', () => unregisterHotkeys());
```

- [ ] **Step 2: Wire pref changes in `src/main/ipc.ts`**

Add the import:

```ts
import { registerHotkeys } from './hotkeys';
```

In the `IPC.prefsSet` handler, add `'muteHotkey'` to the allowed keys and re-register after saving. The handler becomes:

```ts
  ipcMain.handle(IPC.prefsSet, (_e, patch: unknown) => {
    if (typeof patch !== 'object' || patch === null) return store.getPrefs();
    const p = patch as Record<string, unknown>;
    const allowed: (keyof Prefs)[] = ['activeServerId', 'notificationsMuted', 'launchOnStartup', 'lastWindowBounds', 'muteHotkey'];
    const sanitized: Partial<Prefs> = {};
    for (const key of allowed) if (key in p) (sanitized as Record<string, unknown>)[key] = p[key];
    store.setPrefs(sanitized);
    if ('muteHotkey' in sanitized) registerHotkeys(store);
    return store.getPrefs();
  });
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all PASS, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts src/main/ipc.ts
git commit -m "feat: register mute hotkey at startup and on pref change"
```

---

### Task 4: Desktop — keyboard-event → accelerator capture helper

**Files:**
- Create: `src/shared/hotkey-capture.ts`
- Test: `src/shared/hotkey-capture.test.ts`

**Interfaces:**
- Produces: `eventToAccelerator(e: CapturedKey): string | null` and `type CapturedKey = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>`. Lives in `shared/` because the renderer (Servers page) uses it and it must not import Electron.

Capture rules: modifier-only presses → `null`; a combination is valid only with Ctrl/Cmd/Alt, or when the main key is F1–F24; Ctrl and Cmd both map to `CommandOrControl` (cross-platform accelerator); part order is `CommandOrControl+Alt+Shift+Key`.

- [ ] **Step 1: Write the failing tests**

Create `src/shared/hotkey-capture.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { eventToAccelerator } from './hotkey-capture';

const ev = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods
});

describe('eventToAccelerator', () => {
  test('modifier-only presses are rejected', () => {
    expect(eventToAccelerator(ev('Control', { ctrlKey: true }))).toBeNull();
    expect(eventToAccelerator(ev('Shift', { shiftKey: true }))).toBeNull();
    expect(eventToAccelerator(ev('Meta', { metaKey: true }))).toBeNull();
    expect(eventToAccelerator(ev('Alt', { altKey: true }))).toBeNull();
  });
  test('bare keys are rejected (unsafe as global hotkeys)', () => {
    expect(eventToAccelerator(ev('m'))).toBeNull();
    expect(eventToAccelerator(ev('m', { shiftKey: true }))).toBeNull(); // shift alone is not enough
  });
  test('function keys are allowed without modifiers', () => {
    expect(eventToAccelerator(ev('F10'))).toBe('F10');
    expect(eventToAccelerator(ev('F24'))).toBe('F24');
  });
  test('letters are uppercased and modifiers ordered', () => {
    expect(eventToAccelerator(ev('m', { ctrlKey: true, shiftKey: true }))).toBe('CommandOrControl+Shift+M');
    expect(eventToAccelerator(ev('m', { altKey: true }))).toBe('Alt+M');
  });
  test('cmd maps to CommandOrControl like ctrl', () => {
    expect(eventToAccelerator(ev('k', { metaKey: true }))).toBe('CommandOrControl+K');
  });
  test('named keys are translated to accelerator names', () => {
    expect(eventToAccelerator(ev(' ', { ctrlKey: true }))).toBe('CommandOrControl+Space');
    expect(eventToAccelerator(ev('ArrowUp', { altKey: true }))).toBe('Alt+Up');
  });
  test('unmappable named keys are rejected', () => {
    expect(eventToAccelerator(ev('CapsLock', { ctrlKey: true }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- hotkey-capture`
Expected: FAIL — cannot find module `./hotkey-capture`.

- [ ] **Step 3: Implement**

Create `src/shared/hotkey-capture.ts`:

```ts
// Converts a captured KeyboardEvent into an Electron accelerator string,
// or null when the combination is unusable as a global hotkey.
// Shared between the renderer (capture field) and any future main-side use;
// must stay free of Electron imports.
export type CapturedKey = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

const KEY_MAP: Record<string, string> = {
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right'
};

const isFunctionKey = (key: string) => /^F([1-9]|1[0-9]|2[0-4])$/.test(key);

export const eventToAccelerator = (e: CapturedKey): string | null => {
  if (MODIFIER_KEYS.has(e.key)) return null;

  // Shift alone is too easy to hit accidentally for a global hotkey.
  const hasStrongModifier = e.ctrlKey || e.metaKey || e.altKey;
  if (!hasStrongModifier && !isFunctionKey(e.key)) return null;

  let key: string;
  if (isFunctionKey(e.key)) key = e.key;
  else if (e.key in KEY_MAP) key = KEY_MAP[e.key];
  else if (e.key.length === 1) key = e.key.toUpperCase();
  else return null; // CapsLock, Tab, Enter… not supported

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` then `npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/hotkey-capture.ts src/shared/hotkey-capture.test.ts
git commit -m "feat: add keyboard-event to accelerator capture helper"
```

---

### Task 5: Desktop — i18n entries + Servers window capture field

**Files:**
- Modify: `src/shared/i18n/messages.ts` (add 4 codes to `ERROR_CODES` and `MESSAGES`)
- Modify: `src/renderer/pages/Servers.tsx`

**Interfaces:**
- Consumes: `eventToAccelerator` (Task 4), `DEFAULT_MUTE_HOTKEY` + `Prefs` from `../../shared/types` (Task 1), `window.shell.prefs.get/set` (existing preload, already typed in `src/renderer/shell.d.ts` via the `Prefs` type — no typing change needed).
- Produces: a "Global mute shortcut" field in the Servers window; new message codes `mute-hotkey-label`, `mute-hotkey-hint`, `mute-hotkey-reset`, `mute-hotkey-disabled`.

The existing `messages.test.ts` iterates `ERROR_CODES × SUPPORTED_LOCALES` and enforces non-empty entries, so the new codes are covered automatically once added.

- [ ] **Step 1: Add the message codes**

In `src/shared/i18n/messages.ts`, append to the `ERROR_CODES` array (before the closing `] as const;`):

```ts
  'mute-hotkey-label',
  'mute-hotkey-hint',
  'mute-hotkey-reset',
  'mute-hotkey-disabled',
```

Append to the `MESSAGES` catalogue:

```ts
  'mute-hotkey-label': {
    en: 'Global mute shortcut',
    fr: 'Raccourci global du micro',
    es: 'Atajo global de silencio',
    it: 'Scorciatoia globale del microfono',
    ru: 'Глобальная горячая клавиша микрофона',
    zh: '全局静音快捷键',
    cs: 'Globální zkratka ztlumení',
  },
  'mute-hotkey-hint': {
    en: 'Click, then press a key combination. Backspace disables it.',
    fr: 'Clique puis presse une combinaison de touches. Retour arrière pour désactiver.',
    es: 'Haz clic y pulsa una combinación de teclas. Retroceso para desactivar.',
    it: 'Clicca e premi una combinazione di tasti. Backspace per disattivare.',
    ru: 'Нажмите на поле и введите сочетание клавиш. Backspace — отключить.',
    zh: '点击后按下组合键。按退格键可禁用。',
    cs: 'Klikněte a stiskněte kombinaci kláves. Backspace ji vypne.',
  },
  'mute-hotkey-reset': {
    en: 'Reset',
    fr: 'Réinitialiser',
    es: 'Restablecer',
    it: 'Ripristina',
    ru: 'Сбросить',
    zh: '重置',
    cs: 'Obnovit',
  },
  'mute-hotkey-disabled': {
    en: 'Disabled',
    fr: 'Désactivé',
    es: 'Desactivado',
    it: 'Disattivato',
    ru: 'Отключено',
    zh: '已禁用',
    cs: 'Vypnuto',
  },
```

- [ ] **Step 2: Run the i18n tests**

Run: `npm test -- messages`
Expected: PASS (the catalogue test now also validates the 4 new codes in all 7 locales).

- [ ] **Step 3: Add the capture field to `src/renderer/pages/Servers.tsx`**

Replace the full file with:

```tsx
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
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all PASS.

Then run `npm run dev`, open the tray → **Manage servers…**, and check: the field shows `CommandOrControl+Shift+M`; clicking it and pressing `Alt+F5` saves `Alt+F5`; Backspace shows the localized "Disabled"; Reset restores the default.

- [ ] **Step 5: Commit**

```bash
git add src/shared/i18n/messages.ts src/renderer/pages/Servers.tsx
git commit -m "feat: add configurable global mute shortcut field to Servers window"
```

---

### Task 6: Client (bullshark repo) — desktop bridge hook

**Files (all under `C:\Users\Neckr\Documents\bullshark`):**
- Modify: `apps/client/src/vite-env.d.ts`
- Create: `apps/client/src/components/voice-provider/hooks/use-desktop-bridge.ts`
- Modify: `apps/client/src/components/voice-provider/index.tsx` (import near line 75; mount after the `useVad(...)` call at line ~1235)

**Interfaces:**
- Consumes: `window.bullshark.voice.reportState({ inVoice, muted })` and `window.bullshark.voice.onToggleRequest(cb) => unsubscribe` (exposed by the desktop preload `src/preload/bridge.ts` — shipped in existing desktop builds); `toggleMic: () => Promise<void>` from `useVoiceControls`; `currentVoiceChannelId: number | undefined`; `ownVoiceState.micMuted: boolean`.
- Produces: `useDesktopBridge({ inVoice, micMuted, toggleMic })` — a no-op in plain browsers. The mute/unmute beep needs no code: `toggleMic()` already plays `OWN_USER_MUTED_MIC` / `OWN_USER_UNMUTED_MIC` (see `use-voice-controls.ts:70-73`).

No automated test: the client workspace has no test infrastructure (no test script; only `apps/server` runs `bun test`). Verified via `bun run check-types`, `bun run lint`, and Task 7.

- [ ] **Step 1: Add the `window.bullshark` typing**

In `apps/client/src/vite-env.d.ts`, inside `interface Window { ... }`, after the `DEBUG?: boolean;` line, add:

```ts
    // Bullshark Desktop companion API, exposed by the desktop app's
    // sandboxed preload (bullshark-desktop src/preload/bridge.ts).
    // Absent when running in a regular browser.
    bullshark?: {
      isDesktop: boolean;
      notifications: { isMuted: () => boolean };
      voice: {
        reportState: (state: { inVoice: boolean; muted: boolean }) => void;
        onToggleRequest: (cb: () => void) => () => void;
      };
      focusWindow: () => void;
      onMuteChanged: (cb: (muted: boolean) => void) => () => void;
    };
```

- [ ] **Step 2: Create the hook**

Create `apps/client/src/components/voice-provider/hooks/use-desktop-bridge.ts`:

```ts
import { useEffect, useRef } from 'react';

type TUseDesktopBridgeParams = {
  inVoice: boolean;
  micMuted: boolean;
  toggleMic: () => Promise<void>;
};

/**
 * Companion integration for Bullshark Desktop. When the page runs inside the
 * desktop app (window.bullshark is exposed by its preload), this hook:
 *  - reports the live voice state so the tray icon and menu stay in sync;
 *  - applies mute-toggle requests coming from the tray or the global hotkey.
 * In a regular browser it is a complete no-op.
 */
const useDesktopBridge = ({
  inVoice,
  micMuted,
  toggleMic
}: TUseDesktopBridgeParams) => {
  // Refs so the subscription stays stable across prop changes,
  // mirroring the pattern used by usePtt.
  const inVoiceRef = useRef(inVoice);
  const toggleMicRef = useRef(toggleMic);

  useEffect(() => {
    inVoiceRef.current = inVoice;
  }, [inVoice]);

  useEffect(() => {
    toggleMicRef.current = toggleMic;
  }, [toggleMic]);

  useEffect(() => {
    const api = window.bullshark?.voice;

    if (!api) {
      return;
    }

    const unsubscribe = api.onToggleRequest(() => {
      // Not in a voice channel: nothing to toggle, ignore the request.
      if (!inVoiceRef.current) {
        return;
      }

      void toggleMicRef.current();
    });

    return () => {
      unsubscribe();
      // Leave the tray in a clean state when the provider unmounts.
      api.reportState({ inVoice: false, muted: false });
    };
  }, []);

  useEffect(() => {
    window.bullshark?.voice.reportState({ inVoice, muted: micMuted });
  }, [inVoice, micMuted]);
};

export { useDesktopBridge };
```

- [ ] **Step 3: Mount it in the provider**

In `apps/client/src/components/voice-provider/index.tsx`:

Next to the other hook imports (around line 75, where `usePtt` is imported):

```ts
import { useDesktopBridge } from './hooks/use-desktop-bridge';
```

Immediately after the `useVad({ ... });` call (line ~1235-1240):

```ts
  useDesktopBridge({
    inVoice: !!currentVoiceChannelId,
    micMuted: ownVoiceState.micMuted,
    toggleMic
  });
```

- [ ] **Step 4: Verify**

Run from the bullshark repo root: `bun run check-types && bun run lint`
Expected: no errors (pre-existing warnings unrelated to these files are acceptable).

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/vite-env.d.ts apps/client/src/components/voice-provider/hooks/use-desktop-bridge.ts apps/client/src/components/voice-provider/index.tsx
git commit -m "feat: wire desktop voice bridge (tray + global hotkey mute toggle)"
```

---

### Task 7: Manual end-to-end verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything above, running together.

- [ ] **Step 1: Start both apps**

```bash
# Terminal 1 — bullshark server+client dev (repo root)
cd C:\Users\Neckr\Documents\bullshark && bun run --filter '*' dev
# Terminal 2 — desktop
cd C:\Users\Neckr\Documents\bullshark-desktop && npm run dev
```

Point the desktop app at the local dev server (add `http://localhost:5173` — if the desktop URL validator refuses plain http for localhost, use the LAN/dev HTTPS URL you normally test with).

- [ ] **Step 2: Walk the checklist**

1. Join a voice channel in the desktop app. Tray → the **Microphone** item is now enabled and checked (bridge reporting works — previously always disabled).
2. Focus another application (or a game). Press `Ctrl+Shift+M`: you hear the low mute click, the tray icon switches to `mic-muted`, other participants stop hearing you.
3. Press `Ctrl+Shift+M` again: higher unmute click, tray icon back to normal.
4. Toggle mute from the tray menu: same behavior as the hotkey.
5. Toggle mute from the web UI button: tray icon follows (reportState round-trip).
6. Tray → Manage servers…: change the shortcut to `Alt+F5`; verify `Ctrl+Shift+M` no longer works and `Alt+F5` does (live re-registration).
7. Backspace in the field (Disabled): verify no hotkey fires. Reset: default works again.
8. Leave the voice channel: pressing the hotkey does nothing (guard), tray Microphone item disabled again.
9. Open the same client in a plain browser (no desktop): everything works, no console errors mentioning `bullshark`.

- [ ] **Step 3: Report results**

Record any failing checklist item as a bug before claiming completion (superpowers:verification-before-completion).
