# Client↔Server Version Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read the server's reported version via `GET /info` and show layered, non-blocking, localized banners — red when the server is below a hard floor, amber when it lacks the native-features companion change — both dismissible.

**Architecture:** The main process fetches `/info` (no CORS limit in main), compares versions with a tiny zero-dep semver-lite comparator, computes a stable verdict, and sends a localized message to the existing `bridge.cjs` preload over IPC; the preload injects/dismisses a fixed DOM banner. Thresholds live in one module; the native-features layer is dormant (`null`) until the companion ships.

**Tech Stack:** Electron, TypeScript, React, Vitest, electron-vite.

Spec: `docs/superpowers/specs/2026-06-11-version-compatibility-design.md`
Builds on #1 (`src/shared/i18n/locales.ts` `resolveLocale`/`Locale`, `src/shared/i18n/messages.ts` `t`/`ERROR_CODES`/`MESSAGES`).

---

## File Structure

**Create:**
- `src/main/servers/version.ts` (+ `version.test.ts`) — `compareVersions(a,b)`.
- `src/main/servers/server-info.ts` (+ `server-info.test.ts`) — `fetchServerInfo(baseUrl)`.
- `src/main/servers/compat.ts` (+ `compat.test.ts`) — thresholds + `evaluateCompat`.

**Modify:**
- `src/shared/i18n/messages.ts` (+ test) — two new codes in 7 locales.
- `src/shared/ipc.ts` — `BRIDGE.compat` channel.
- `src/shared/types.ts` — `CompatBannerPayload` type.
- `src/main/windows/main-window.ts` — fetch + evaluate + send on load.
- `tsconfig.node.json` — stop type-checking `src/preload` here (web config covers it, with DOM).
- `src/preload/bridge.ts` — inject/dismiss the banner.

---

## Task 1: Version comparison

**Files:**
- Create: `src/main/servers/version.ts`
- Test: `src/main/servers/version.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/main/servers/version.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { compareVersions } from './version';

describe('compareVersions', () => {
  test('orders by major, minor, patch numerically', () => {
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('0.1.0', '0.2.0')).toBe(-1);
    expect(compareVersions('2.0.0', '10.0.0')).toBe(-1);
  });
  test('treats missing patch as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
  });
  test('ignores a leading v', () => {
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
  });
  test('a pre-release sorts below the same released version', () => {
    expect(compareVersions('0.1.0-alpha', '0.1.0')).toBe(-1);
    expect(compareVersions('0.1.0', '0.1.0-alpha')).toBe(1);
  });
  test('compares pre-release identifiers lexically', () => {
    expect(compareVersions('0.1.0-alpha', '0.1.0-beta')).toBe(-1);
  });
  test('garbage input does not throw and sorts as zeros', () => {
    expect(compareVersions('garbage', '0.0.0')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- version`
Expected: FAIL — cannot resolve `./version`.

- [ ] **Step 3: Write minimal implementation**

Create `src/main/servers/version.ts`:

```ts
type Parsed = { nums: number[]; pre: string };

const parse = (v: string): Parsed => {
  const cleaned = v.trim().replace(/^v/i, '');
  const [core, pre = ''] = cleaned.split('-', 2);
  const nums = core.split('.').map((n) => {
    const x = parseInt(n, 10);
    return Number.isFinite(x) ? x : 0;
  });
  return { nums, pre };
};

export const compareVersions = (a: string, b: string): -1 | 0 | 1 => {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const na = pa.nums[i] ?? 0;
    const nb = pb.nums[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  if (pa.pre && !pb.pre) return -1;
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre > pb.pre) return 1;
  if (pa.pre < pb.pre) return -1;
  return 0;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- version`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/servers/version.ts src/main/servers/version.test.ts
git commit -m "feat(servers): zero-dep semver-lite compareVersions"
```

---

## Task 2: Fetch server info

**Files:**
- Create: `src/main/servers/server-info.ts`
- Test: `src/main/servers/server-info.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/main/servers/server-info.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { fetchServerInfo } from './server-info';

const resp = (status: number, body: unknown): Response =>
  ({ status, json: async () => body }) as unknown as Response;

describe('fetchServerInfo', () => {
  test('returns the version from a 200 /info payload', async () => {
    const r = await fetchServerInfo('https://a.com', async () => resp(200, { version: '0.1.0', name: 'x' }));
    expect(r).toEqual({ version: '0.1.0' });
  });
  test('requests the /info path on the base URL', async () => {
    let called = '';
    await fetchServerInfo('https://a.com', async (url) => { called = url; return resp(200, { version: '1.0.0' }); });
    expect(called).toBe('https://a.com/info');
  });
  test('null on non-2xx', async () => {
    expect(await fetchServerInfo('https://a.com', async () => resp(404, {}))).toBeNull();
  });
  test('null when fetch throws', async () => {
    expect(await fetchServerInfo('https://a.com', async () => { throw new Error('boom'); })).toBeNull();
  });
  test('null when version is missing or not a string', async () => {
    expect(await fetchServerInfo('https://a.com', async () => resp(200, { name: 'x' }))).toBeNull();
    expect(await fetchServerInfo('https://a.com', async () => resp(200, { version: 12 }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- server-info`
Expected: FAIL — cannot resolve `./server-info`.

- [ ] **Step 3: Write minimal implementation**

Create `src/main/servers/server-info.ts`:

```ts
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const fetchServerInfo = async (
  baseUrl: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 4000
): Promise<{ version: string } | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/info`, {
      method: 'GET',
      signal: controller.signal
    });
    if (res.status < 200 || res.status >= 300) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data?.version === 'string' ? { version: data.version } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- server-info`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/servers/server-info.ts src/main/servers/server-info.test.ts
git commit -m "feat(servers): tolerant fetchServerInfo (/info -> version | null)"
```

---

## Task 3: Compatibility verdict

**Files:**
- Create: `src/main/servers/compat.ts`
- Test: `src/main/servers/compat.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/main/servers/compat.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { evaluateCompat, MIN_SERVER_VERSION, MIN_SERVER_VERSION_NATIVE_FEATURES } from './compat';

describe('evaluateCompat', () => {
  test('null version → unknown', () => {
    expect(evaluateCompat(null)).toBe('unknown');
  });
  test('below the floor → too-old', () => {
    expect(evaluateCompat('0.0.5', '0.1.0', null)).toBe('too-old');
  });
  test('between floor and native threshold → native-unavailable', () => {
    expect(evaluateCompat('0.2.0', '0.1.0', '0.3.0')).toBe('native-unavailable');
  });
  test('at or above the native threshold → ok', () => {
    expect(evaluateCompat('0.3.0', '0.1.0', '0.3.0')).toBe('ok');
  });
  test('native layer dormant when threshold is null → ok', () => {
    expect(evaluateCompat('0.5.0', '0.1.0', null)).toBe('ok');
  });
  test('shipped defaults treat a normal version as ok', () => {
    expect(evaluateCompat('0.1.0')).toBe('ok');
  });
  test('shipped defaults: floor is permissive, native layer dormant', () => {
    expect(MIN_SERVER_VERSION).toBe('0.0.0');
    expect(MIN_SERVER_VERSION_NATIVE_FEATURES).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- compat`
Expected: FAIL — cannot resolve `./compat`.

- [ ] **Step 3: Write minimal implementation**

Create `src/main/servers/compat.ts`:

```ts
import { compareVersions } from './version';

// Single source of truth for compatibility thresholds.
// Bump MIN_SERVER_VERSION when a real client/server API break appears.
// Set MIN_SERVER_VERSION_NATIVE_FEATURES to the server version where the
// window.bullshark companion change ships; until then the layer is dormant.
export const MIN_SERVER_VERSION = '0.0.0';
export const MIN_SERVER_VERSION_NATIVE_FEATURES: string | null = null;

export type CompatVerdict = 'ok' | 'too-old' | 'native-unavailable' | 'unknown';

export const evaluateCompat = (
  version: string | null,
  minVersion: string = MIN_SERVER_VERSION,
  minNative: string | null = MIN_SERVER_VERSION_NATIVE_FEATURES
): CompatVerdict => {
  if (version === null) return 'unknown';
  if (compareVersions(version, minVersion) < 0) return 'too-old';
  if (minNative !== null && compareVersions(version, minNative) < 0) return 'native-unavailable';
  return 'ok';
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- compat`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/servers/compat.ts src/main/servers/compat.test.ts
git commit -m "feat(servers): evaluateCompat with hard-floor + dormant native layer"
```

---

## Task 4: i18n messages for the banners

**Files:**
- Modify: `src/shared/i18n/messages.ts`
- Test: `src/shared/i18n/messages.test.ts`

- [ ] **Step 1: Add the failing test**

In `src/shared/i18n/messages.test.ts`, add this test inside the existing `describe('messages catalogue', ...)` block:

```ts
  test('compat banner codes exist and are localized', () => {
    expect(ERROR_CODES).toContain('server-too-old');
    expect(ERROR_CODES).toContain('server-native-unavailable');
    expect(t('server-too-old', 'fr')).toBe(MESSAGES['server-too-old'].fr);
    expect(t('server-native-unavailable', 'cs')).toBe(MESSAGES['server-native-unavailable'].cs);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- messages`
Expected: FAIL — `server-too-old` not in `ERROR_CODES` / not in `MESSAGES`.

- [ ] **Step 3: Add the codes and translations**

In `src/shared/i18n/messages.ts`, add the two codes to the END of the `ERROR_CODES` array (after `'unreachable',`):

```ts
  'server-too-old',
  'server-native-unavailable',
```

Then add these two entries at the END of the `MESSAGES` object (after the `unreachable: { ... },` entry):

```ts
  'server-too-old': {
    en: 'This server is older than this app supports — some features may not work. Update your Bullshark server.',
    fr: "Ce serveur est plus ancien que ce que cette application prend en charge — certaines fonctions peuvent ne pas marcher. Mets à jour ton serveur Bullshark.",
    es: 'Este servidor es más antiguo de lo que admite esta aplicación: algunas funciones pueden no funcionar. Actualiza tu servidor Bullshark.',
    it: 'Questo server è più vecchio di quanto supporti questa app: alcune funzioni potrebbero non funzionare. Aggiorna il tuo server Bullshark.',
    ru: 'Этот сервер старее, чем поддерживает приложение — некоторые функции могут не работать. Обновите сервер Bullshark.',
    zh: '此服务器版本低于本应用支持的版本——部分功能可能无法使用。请更新你的 Bullshark 服务器。',
    cs: 'Tento server je starší, než tato aplikace podporuje – některé funkce nemusí fungovat. Aktualizujte svůj server Bullshark.',
  },
  'server-native-unavailable': {
    en: "This server doesn't support the desktop's native features yet (notification DND, mic mute). Update your Bullshark server.",
    fr: "Ce serveur ne prend pas encore en charge les fonctions natives du bureau (mode silencieux des notifications, coupure du micro). Mets à jour ton serveur Bullshark.",
    es: 'Este servidor aún no admite las funciones nativas del escritorio (no molestar en notificaciones, silenciar micrófono). Actualiza tu servidor Bullshark.',
    it: 'Questo server non supporta ancora le funzioni native del desktop (Non disturbare per le notifiche, disattivazione del microfono). Aggiorna il tuo server Bullshark.',
    ru: 'Этот сервер пока не поддерживает нативные функции приложения (режим «не беспокоить» для уведомлений, отключение микрофона). Обновите сервер Bullshark.',
    zh: '此服务器尚不支持桌面端的原生功能（通知免打扰、麦克风静音）。请更新你的 Bullshark 服务器。',
    cs: 'Tento server zatím nepodporuje nativní funkce aplikace (Nerušit pro oznámení, ztlumení mikrofonu). Aktualizujte svůj server Bullshark.',
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- messages`
Expected: PASS (the new test plus the existing completeness test, which now also covers the two codes across all 7 locales).

- [ ] **Step 5: Commit**

```bash
git add src/shared/i18n/messages.ts src/shared/i18n/messages.test.ts
git commit -m "feat(i18n): server-too-old + server-native-unavailable in 7 locales"
```

---

## Task 5: IPC channel, payload type, and main-window wiring

**Files:**
- Modify: `src/shared/ipc.ts`, `src/shared/types.ts`, `src/main/windows/main-window.ts`

Verified by `npm run typecheck` (crosses the process boundary; no unit test).

- [ ] **Step 1: Add the BRIDGE channel**

In `src/shared/ipc.ts`, add `compat` to the `BRIDGE` object. It currently ends:

```ts
  focusWindow: 'bridge:focus-window'         // remote → main (show/focus the window)
} as const;
```

Change to:

```ts
  focusWindow: 'bridge:focus-window',        // remote → main (show/focus the window)
  compat: 'bridge:compat'                    // main → remote ({ verdict, message })
} as const;
```

- [ ] **Step 2: Add the payload type**

In `src/shared/types.ts`, add at the end of the file:

```ts
export type CompatBannerPayload = {
  verdict: 'too-old' | 'native-unavailable';
  message: string;
};
```

- [ ] **Step 3: Wire the check into the server window**

Replace the full contents of `src/main/windows/main-window.ts` with:

```ts
import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import type { ServerEntry } from '../../shared/types';
import { applyNavigationGuards } from '../navigation';
import { partitionForServer } from '../servers/session';
import { fetchServerInfo } from '../servers/server-info';
import { evaluateCompat } from '../servers/compat';
import { resolveLocale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';
import { BRIDGE } from '../../shared/ipc';

let mainWindow: BrowserWindow | null = null;

export const getMainWindow = () => mainWindow;

export const showMainWindow = () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
};

// Reads the server version and, if it warrants a banner, sends a localized
// message to the bridge preload. Never throws into the load path.
const sendCompatBanner = async (win: BrowserWindow, serverUrl: string) => {
  try {
    const info = await fetchServerInfo(serverUrl);
    const verdict = evaluateCompat(info?.version ?? null);
    if (verdict !== 'too-old' && verdict !== 'native-unavailable') return;
    const code = verdict === 'too-old' ? 'server-too-old' : 'server-native-unavailable';
    const message = t(code, resolveLocale(app.getLocale()));
    if (!win.isDestroyed()) win.webContents.send(BRIDGE.compat, { verdict, message });
  } catch {
    // a compatibility check must never break loading the server
  }
};

// Loads the remote Bullshark instance full-bleed in the server's own partition.
export const openServerWindow = (server: ServerEntry) => {
  if (!mainWindow) {
    mainWindow = new BrowserWindow({
      width: 1100,
      height: 750,
      show: false,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        partition: partitionForServer(server.id),
        preload: join(import.meta.dirname, '../preload/bridge.cjs')
      }
    });
    mainWindow.once('ready-to-show', () => mainWindow?.show());
    // Close hides to tray (the real quit path is wired with the tray task).
    mainWindow.on('close', (event) => {
      if (!(global as { isQuitting?: boolean }).isQuitting) {
        event.preventDefault();
        mainWindow?.hide();
      }
    });
  } else {
    // Switching servers requires a fresh partition -> recreate the window.
    mainWindow.destroy();
    mainWindow = null;
    openServerWindow(server);
    return;
  }
  applyNavigationGuards(mainWindow.webContents, new URL(server.url).origin);
  mainWindow.webContents.once('did-finish-load', () => {
    void sendCompatBanner(mainWindow!, server.url);
  });
  void mainWindow.loadURL(server.url);
};
```

- [ ] **Step 4: Verify types compile**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc.ts src/shared/types.ts src/main/windows/main-window.ts
git commit -m "feat(compat): evaluate server version on load and signal the preload"
```

---

## Task 6: Banner injection in the preload

**Files:**
- Modify: `tsconfig.node.json`, `src/preload/bridge.ts`

The preload runs in the renderer and needs DOM types. `tsconfig.node.json` (which has no DOM lib) currently also type-checks `src/preload`; `tsconfig.web.json` already includes `src/preload` and has the DOM lib. So we stop type-checking the preload under the node config and let the web config cover it. Verified by `npm run typecheck` + a manual smoke.

- [ ] **Step 1: Move preload type-checking to the web config**

In `tsconfig.node.json`, change the `include` line:

```json
  "include": ["src/main", "src/preload", "src/shared", "electron.vite.config.ts"]
```

to:

```json
  "include": ["src/main", "src/shared", "electron.vite.config.ts"]
```

(`tsconfig.web.json` already lists `src/preload` and supplies `"lib": ["ES2022", "DOM", "DOM.Iterable"]`.)

- [ ] **Step 2: Add the banner to the bridge preload**

In `src/preload/bridge.ts`, add the import of the payload type at the top (after the existing imports):

```ts
import type { CompatBannerPayload } from '../shared/types';
```

Then add this block immediately before the `contextBridge.exposeInMainWorld('bullshark', { ... })` call:

```ts
const showCompatBanner = ({ verdict, message }: CompatBannerPayload) => {
  const inject = () => {
    document.getElementById('bullshark-compat-banner')?.remove();
    const bar = document.createElement('div');
    bar.id = 'bullshark-compat-banner';
    bar.textContent = message;
    Object.assign(bar.style, {
      position: 'fixed', top: '0', left: '0', right: '0', zIndex: '2147483647',
      padding: '8px 40px 8px 12px', fontFamily: 'system-ui, sans-serif',
      fontSize: '13px', lineHeight: '1.4',
      color: verdict === 'too-old' ? '#ffffff' : '#222222',
      background: verdict === 'too-old' ? '#c0392b' : '#f0ad4e',
      boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
    } as Partial<CSSStyleDeclaration>);
    const close = document.createElement('button');
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Dismiss');
    Object.assign(close.style, {
      position: 'absolute', top: '4px', right: '8px', background: 'transparent',
      border: 'none', color: 'inherit', fontSize: '14px', cursor: 'pointer'
    } as Partial<CSSStyleDeclaration>);
    close.addEventListener('click', () => bar.remove());
    bar.appendChild(close);
    document.body.appendChild(bar);
  };
  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject, { once: true });
};

ipcRenderer.on(BRIDGE.compat, (_e, payload: CompatBannerPayload) => showCompatBanner(payload));
```

- [ ] **Step 3: Verify the full suite + types + lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 4: Manual smoke (recommended)**

To exercise the red banner without an old server, temporarily set `MIN_SERVER_VERSION` in `src/main/servers/compat.ts` to a high value (e.g. `'99.0.0'`), run `npm run dev`, connect to any reachable Bullshark server, and confirm a red dismissible banner appears at the top with the localized text; click ✕ to dismiss. **Revert the constant to `'0.0.0'` afterward** and re-run `npm test`.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.node.json src/preload/bridge.ts
git commit -m "feat(ui): dismissible server-compatibility banner in the bridge preload"
```

---

## Self-Review Notes

- **Spec coverage:** `/info` read (Task 2), tolerant null on missing/unparseable (Task 2 → `unknown` in Task 3), semver-lite incl. pre-release (Task 1), two-layer verdict with dormant native layer (Task 3), warn-only/never-block (no blocking code anywhere; banner only), preload-injected dismissible banners red/amber (Task 6), per-window in-memory dismissal (close removes element; re-sent on next `did-finish-load` per window — Task 5/6), 7-locale messages (Task 4), locale via `resolveLocale(app.getLocale())` (Task 5). All covered.
- **No placeholders:** every translation, constant, and code block is concrete.
- **Type consistency:** `CompatVerdict` (`compat.ts`) is the superset; `CompatBannerPayload.verdict` (`shared/types.ts`) is the `'too-old' | 'native-unavailable'` subset actually sent; main maps verdict→i18n code (`server-too-old`/`server-native-unavailable`), both present in `ERROR_CODES`/`MESSAGES`; `t(code, locale)` accepts `string` and falls back (from #1). `BRIDGE.compat` used identically in `main-window.ts` and `bridge.ts`.
- **tsconfig change rationale:** preload uses DOM (`document`) which `tsconfig.node.json` lacks; moving preload type-checking to the web config (which has DOM and already includes `src/preload`) is the minimal correct fix and keeps `src/main` free of DOM globals.
