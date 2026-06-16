# Desktop "Server Update Available → Reload" Banner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the connected server has been updated to a version newer than the page currently loaded in the desktop window, show a non-intrusive banner (on window focus) offering to reload — so users get the new server UI without a full app quit/relaunch.

**Architecture:** The Electron **main** process captures the loaded server version on `did-finish-load`, re-checks `/info` on the window's `focus` event (throttled 30 s), and — if the server is strictly newer than what's loaded and not already notified — sends a localized payload over a new `BRIDGE.updateAvailable` IPC channel. The injected **bridge preload** renders a banner (same style as the existing compatibility banner) with a Reload button that sends `BRIDGE.reloadRequest` back to main, which calls `webContents.reload()`. Pure decision logic lives in a unit-tested helper.

**Tech Stack:** Electron, TypeScript, electron-vite, vitest. Repo: `bullshark-desktop`, branch `development`.

---

## Conventions (read before starting)

- Run from repo root `C:\Users\Neckr\Documents\bullshark-desktop` (or `/c/Users/Neckr/Documents/bullshark-desktop`).
- Tests: `bun run test` (alias for `vitest run`). Type-check: `bun run typecheck`. Lint: `bun run lint`. Build: `bun run build` (electron-vite — heavier; only in final verification).
- Test files are colocated next to source, `import { describe, expect, test } from 'vitest';` (see `src/main/servers/compat.test.ts`).
- Commit on `development` directly. Do NOT push. End each commit body with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Existing helpers to reuse (do NOT reinvent):
  - `fetchServerInfo(baseUrl): Promise<{ version: string } | null>` — `src/main/servers/server-info.ts`
  - `compareVersions(a, b): -1 | 0 | 1` — `src/main/servers/version.ts`
  - `t(code, locale): string` + `ERROR_CODES` + `MESSAGES` — `src/shared/i18n/messages.ts`
  - `SUPPORTED_LOCALES`, `resolveLocale(appLocale)` — `src/shared/i18n/locales.ts`
  - `BRIDGE` channels — `src/shared/bridge.ts`; preload banner pattern — `src/preload/bridge.ts` (`showCompatBanner`)
- The desktop runs a single `mainWindow` at a time (switching servers destroys + recreates it, see `src/main/windows/main-window.ts:59-64`), so version-tracking state is module-level in `main-window.ts`, reset whenever the window is (re)created.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/shared/i18n/messages.ts` | Localized strings | Add `update-available` + `reload` codes (7 locales each) |
| `src/shared/i18n/messages.test.ts` | i18n coverage | Add assertion for the two new codes |
| `src/shared/bridge.ts` | IPC channel names | Add `updateAvailable` (main→remote) + `reloadRequest` (remote→main) |
| `src/shared/types.ts` | Shared payload types | Add `UpdateBannerPayload` |
| `src/main/servers/update-check.ts` | **New.** Pure decision: should we notify? | Create `shouldNotifyUpdate(...)` |
| `src/main/servers/update-check.test.ts` | **New.** Unit tests for the above | Create |
| `src/main/windows/main-window.ts` | Window lifecycle + version tracking + IPC reload | Wire detection + send banner + reload handler |
| `src/preload/bridge.ts` | DOM-injected banners in the remote page | Render the update banner with Reload button |

---

## Task 1: i18n codes (`update-available`, `reload`)

**Files:**
- Modify: `src/shared/i18n/messages.ts`
- Test: `src/shared/i18n/messages.test.ts`

- [ ] **Step 1: Add the failing test**

Append this `test` block inside the existing `describe('messages catalogue', …)` in `src/shared/i18n/messages.test.ts`:

```typescript
  test('update-banner codes exist and are localized', () => {
    expect(ERROR_CODES).toContain('update-available');
    expect(ERROR_CODES).toContain('reload');
    expect(t('update-available', 'fr')).toBe(MESSAGES['update-available'].fr);
    expect(t('reload', 'cs')).toBe(MESSAGES['reload'].cs);
  });
```

- [ ] **Step 2: Run it, verify it fails**

Run: `bun run test src/shared/i18n/messages.test.ts`
Expected: FAIL — `ERROR_CODES` does not contain `'update-available'` / `MESSAGES['update-available']` is undefined. (The exhaustive "every error code … all 7 locales" test still passes since the codes don't exist yet.)

- [ ] **Step 3: Add the codes**

In `src/shared/i18n/messages.ts`, add the two codes to the `ERROR_CODES` array (before the closing `] as const;`):

```typescript
  'server-native-unavailable',
  'update-available',
  'reload',
] as const;
```

Then add the two entries to the `MESSAGES` object (after the `'server-native-unavailable'` entry, before the closing `};`):

```typescript
  'update-available': {
    en: 'This server was updated. Reload to get the latest version.',
    fr: 'Ce serveur a été mis à jour. Recharge pour obtenir la dernière version.',
    es: 'Este servidor se ha actualizado. Recarga para obtener la última versión.',
    it: "Questo server è stato aggiornato. Ricarica per ottenere l'ultima versione.",
    ru: 'Этот сервер был обновлён. Перезагрузите, чтобы получить последнюю версию.',
    zh: '此服务器已更新。重新加载以获取最新版本。',
    cs: 'Tento server byl aktualizován. Načtěte znovu pro nejnovější verzi.',
  },
  reload: {
    en: 'Reload',
    fr: 'Recharger',
    es: 'Recargar',
    it: 'Ricarica',
    ru: 'Перезагрузить',
    zh: '重新加载',
    cs: 'Načíst znovu',
  },
```

- [ ] **Step 4: Run tests, verify pass**

Run: `bun run test src/shared/i18n/messages.test.ts`
Expected: PASS (the new test + the existing exhaustive all-locales test both green).

- [ ] **Step 5: Commit**

```bash
git add src/shared/i18n/messages.ts src/shared/i18n/messages.test.ts
git commit -m "feat(i18n): add update-available + reload banner strings"
```

---

## Task 2: Bridge channels + payload type

**Files:**
- Modify: `src/shared/bridge.ts`
- Modify: `src/shared/types.ts`

No unit test (these are type/constant declarations); verified by `typecheck` + their consumers in later tasks.

- [ ] **Step 1: Add the bridge channels**

In `src/shared/bridge.ts`, add two entries to the `BRIDGE` object (after `compat`):

```typescript
export const BRIDGE = {
  setMuted: 'bridge:set-muted',              // main → remote (DND state)
  voiceToggleRequest: 'bridge:voice-toggle', // main → remote (toggle mic)
  voiceState: 'bridge:voice-state',          // remote → main ({ inVoice, muted })
  focusWindow: 'bridge:focus-window',        // remote → main (show/focus the window)
  compat: 'bridge:compat',                   // main → remote ({ verdict, message })
  updateAvailable: 'bridge:update-available',// main → remote ({ message, reloadLabel })
  reloadRequest: 'bridge:reload-request'     // remote → main (reload the page)
} as const;
```

- [ ] **Step 2: Add the payload type**

In `src/shared/types.ts`, add after the `CompatBannerPayload` type:

```typescript
export type UpdateBannerPayload = {
  message: string;
  reloadLabel: string;
};
```

- [ ] **Step 3: Type-check**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/bridge.ts src/shared/types.ts
git commit -m "feat(bridge): add updateAvailable + reloadRequest channels and payload"
```

---

## Task 3: Pure decision helper `shouldNotifyUpdate`

**Files:**
- Create: `src/main/servers/update-check.ts`
- Test: `src/main/servers/update-check.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/main/servers/update-check.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { shouldNotifyUpdate } from './update-check';

describe('shouldNotifyUpdate', () => {
  test('server strictly newer than loaded, not yet notified → true', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: '0.1.0', currentVersion: '0.1.1', notifiedVersion: null })
    ).toBe(true);
  });

  test('server equal to loaded → false', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: '0.1.1', currentVersion: '0.1.1', notifiedVersion: null })
    ).toBe(false);
  });

  test('server older than loaded → false', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: '0.2.0', currentVersion: '0.1.0', notifiedVersion: null })
    ).toBe(false);
  });

  test('currentVersion null (fetch failed) → false', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: '0.1.0', currentVersion: null, notifiedVersion: null })
    ).toBe(false);
  });

  test('loadedVersion null (baseline unknown) → false', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: null, currentVersion: '0.1.1', notifiedVersion: null })
    ).toBe(false);
  });

  test('newer but already notified for that exact version (dedup) → false', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: '0.1.0', currentVersion: '0.1.1', notifiedVersion: '0.1.1' })
    ).toBe(false);
  });

  test('newer than loaded AND newer than a stale notifiedVersion → true', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: '0.1.0', currentVersion: '0.1.2', notifiedVersion: '0.1.1' })
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `bun run test src/main/servers/update-check.test.ts`
Expected: FAIL — `Cannot find module './update-check'`.

- [ ] **Step 3: Implement the helper**

Create `src/main/servers/update-check.ts`:

```typescript
import { compareVersions } from './version';

type UpdateCheckInput = {
  loadedVersion: string | null;
  currentVersion: string | null;
  notifiedVersion: string | null;
};

// Pure decision: should the desktop show an "update available → reload" banner?
// True iff the server is strictly newer than the page currently loaded and we
// have not already notified for this exact server version (dedup). A failed
// /info fetch (currentVersion null) or unknown baseline (loadedVersion null)
// yields false — never a false positive.
export const shouldNotifyUpdate = ({
  loadedVersion,
  currentVersion,
  notifiedVersion
}: UpdateCheckInput): boolean => {
  if (currentVersion === null || loadedVersion === null) return false;
  if (currentVersion === notifiedVersion) return false;
  return compareVersions(currentVersion, loadedVersion) === 1;
};
```

- [ ] **Step 4: Run tests, verify pass**

Run: `bun run test src/main/servers/update-check.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/servers/update-check.ts src/main/servers/update-check.test.ts
git commit -m "feat(main): shouldNotifyUpdate decision helper for server-update banner"
```

---

## Task 4: Wire detection + reload into the server window

**Files:**
- Modify: `src/main/windows/main-window.ts`

No unit test (Electron window/IPC wiring); verified by `typecheck` + the manual smoke test in Task 6. Implement carefully and follow the existing structure of this file.

- [ ] **Step 1: Update imports**

In `src/main/windows/main-window.ts`, change the electron import to add `ipcMain`, and add imports for the new helper, `compareVersions` is NOT needed here (the helper encapsulates it). Add `BRIDGE` is already imported via `'../../shared/bridge'`. Update the top imports to:

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import type { ServerEntry, UpdateBannerPayload } from '../../shared/types';
import { applyNavigationGuards } from '../navigation';
import { partitionForServer } from '../servers/session';
import { fetchServerInfo } from '../servers/server-info';
import { evaluateCompat } from '../servers/compat';
import { shouldNotifyUpdate } from '../servers/update-check';
import { resolveLocale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';
import { BRIDGE } from '../../shared/bridge';
import { installScreenShareHandler } from '../screen-share';
```

(If `ServerEntry` was imported from a different relative path in the original, keep that path and just add `UpdateBannerPayload` to the same import; the snippet above matches the current file.)

- [ ] **Step 2: Add module-level version-tracking state + reload IPC handler**

Immediately after the existing `let mainWindow: BrowserWindow | null = null;` line, add:

```typescript
// Version of the server page currently loaded in mainWindow (captured on each
// did-finish-load). Used to detect that the server was deployed-newer while the
// window stayed open. Reset whenever the window is (re)created.
let loadedVersion: string | null = null;
let notifiedVersion: string | null = null;
let lastUpdateCheckAt = 0;
const UPDATE_CHECK_THROTTLE_MS = 30_000;

// Remote pages send this when the user clicks "Reload" in the update banner.
// Registered once at module load; reloads whichever window sent it.
ipcMain.on(BRIDGE.reloadRequest, (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.webContents.reload();
});
```

- [ ] **Step 3: Add the version-capture and update-check helpers**

Add these two functions just above `export const openServerWindow` (after `sendCompatBanner`):

```typescript
// Captures the version the freshly-loaded page corresponds to, and clears any
// prior "notified" marker so a new banner can fire for a future deploy. Never
// throws into the load path.
const captureLoadedVersion = async (serverUrl: string) => {
  try {
    const info = await fetchServerInfo(serverUrl);
    loadedVersion = info?.version ?? null;
    notifiedVersion = null;
  } catch {
    // a version capture must never break loading the server
  }
};

// On window focus (throttled), re-check /info; if the server is newer than the
// loaded page and not already notified, push a localized update banner.
const checkForServerUpdate = async (server: ServerEntry) => {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;

  const now = Date.now();
  if (now - lastUpdateCheckAt < UPDATE_CHECK_THROTTLE_MS) return;
  lastUpdateCheckAt = now;

  try {
    const info = await fetchServerInfo(server.url);
    const currentVersion = info?.version ?? null;

    if (!shouldNotifyUpdate({ loadedVersion, currentVersion, notifiedVersion })) {
      return;
    }

    notifiedVersion = currentVersion;
    const locale = resolveLocale(app.getLocale());
    const payload: UpdateBannerPayload = {
      message: t('update-available', locale),
      reloadLabel: t('reload', locale)
    };
    if (!win.isDestroyed()) win.webContents.send(BRIDGE.updateAvailable, payload);
  } catch {
    // a background update check must never break anything
  }
};
```

- [ ] **Step 4: Reset state on window creation, switch did-finish-load to `.on`, add focus handler**

In `openServerWindow`, when the window is first created (inside the `if (!mainWindow) { … }` block), reset the tracking state right after assigning `mainWindow = new BrowserWindow({ … })`. Add this line immediately after the `mainWindow.once('ready-to-show', …)` line (anywhere inside the creation block is fine, but keep it before the handlers below):

```typescript
    loadedVersion = null;
    notifiedVersion = null;
    lastUpdateCheckAt = 0;
```

Then, at the bottom of `openServerWindow` (the part that runs for the freshly-created window), replace the existing `did-finish-load` wiring:

```typescript
  mainWindow.webContents.once('did-finish-load', () => {
    void sendCompatBanner(mainWindow!, server.url);
  });
```

with this (note `.once` → `.on`, and the added version capture + focus handler):

```typescript
  // .on (not .once): re-capture the baseline after every load, including reloads
  // triggered by the update banner — otherwise loadedVersion stays stale.
  mainWindow.webContents.on('did-finish-load', () => {
    void sendCompatBanner(mainWindow!, server.url);
    void captureLoadedVersion(server.url);
  });

  mainWindow.on('focus', () => {
    void checkForServerUpdate(server);
  });
```

- [ ] **Step 5: Type-check**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/windows/main-window.ts
git commit -m "feat(main): detect newer server version on focus and push reload banner"
```

---

## Task 5: Render the update banner in the bridge preload

**Files:**
- Modify: `src/preload/bridge.ts`

No unit test (preload DOM injection in a sandboxed context); verified by `typecheck` + the manual smoke test in Task 6. Mirror the existing `showCompatBanner`.

- [ ] **Step 1: Import the payload type**

In `src/preload/bridge.ts`, extend the existing type import to include `UpdateBannerPayload`:

```typescript
import type { VoiceState, CompatBannerPayload, UpdateBannerPayload } from '../shared/types';
```

- [ ] **Step 2: Add the update-banner renderer + listener**

Add this function right after `showCompatBanner` (before the `ipcRenderer.on(BRIDGE.compat, …)` line), then add the listener line after the existing compat listener:

```typescript
const showUpdateBanner = ({ message, reloadLabel }: UpdateBannerPayload) => {
  const inject = () => {
    document.getElementById('bullshark-update-banner')?.remove();
    const bar = document.createElement('div');
    bar.id = 'bullshark-update-banner';
    Object.assign(bar.style, {
      position: 'fixed', top: '0', left: '0', right: '0', zIndex: '2147483647',
      padding: '8px 40px 8px 12px', fontFamily: 'system-ui, sans-serif',
      fontSize: '13px', lineHeight: '1.4', color: '#ffffff',
      background: '#2d7d46', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: '12px'
    } as Partial<CSSStyleDeclaration>);

    const label = document.createElement('span');
    label.textContent = message;
    label.style.flex = '1';

    const reload = document.createElement('button');
    reload.textContent = reloadLabel;
    Object.assign(reload.style, {
      background: '#ffffff', color: '#2d7d46', border: 'none',
      borderRadius: '4px', padding: '4px 12px', fontSize: '13px',
      fontWeight: '600', cursor: 'pointer', flex: '0 0 auto'
    } as Partial<CSSStyleDeclaration>);
    reload.addEventListener('click', () => ipcRenderer.send(BRIDGE.reloadRequest));

    const close = document.createElement('button');
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Dismiss');
    Object.assign(close.style, {
      position: 'absolute', top: '4px', right: '8px', background: 'transparent',
      border: 'none', color: 'inherit', fontSize: '14px', cursor: 'pointer'
    } as Partial<CSSStyleDeclaration>);
    close.addEventListener('click', () => bar.remove());

    bar.appendChild(label);
    bar.appendChild(reload);
    bar.appendChild(close);
    document.body.appendChild(bar);
  };
  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject, { once: true });
};

ipcRenderer.on(BRIDGE.updateAvailable, (_e, payload: UpdateBannerPayload) => showUpdateBanner(payload));
```

- [ ] **Step 3: Type-check**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/preload/bridge.ts
git commit -m "feat(preload): render server-update banner with reload button"
```

---

## Task 6: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full unit suite**

Run: `bun run test`
Expected: all tests pass, including `update-check.test.ts` (7) and the i18n catalogue tests.

- [ ] **Step 2: Type-check + lint**

Run: `bun run typecheck && bun run lint`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `bun run build`
Expected: electron-vite build succeeds (main, preload, renderer bundles emitted).

- [ ] **Step 4: Manual smoke test (document the result)**

Against a real running server (or two server builds with different versions in `/info`):
1. Launch the desktop app, open the server. Confirm no update banner appears (loaded == current).
2. Deploy/point to a server whose `/info` version is strictly higher than the loaded page's version.
3. Blur then focus the desktop window. Within one focus (after ≤30 s throttle), the green "This server was updated. Reload…" banner appears.
4. Click **Reload** → the window reloads, the banner disappears, and the new UI (e.g. the Backup tab) is present.
5. Trigger again, then click **✕** → banner dismisses and does NOT reappear on subsequent focuses for the same version.

- [ ] **Step 5: Commit (if any verification-driven fixups were needed)**

```bash
git add -A
git commit -m "chore(desktop): verify server-update reload banner end-to-end"
```
(Skip if nothing changed.)

---

## Self-Review

**Spec coverage:**
- Detection on focus, throttled 30 s → Task 4 (`checkForServerUpdate`, `UPDATE_CHECK_THROTTLE_MS`). ✅
- Baseline captured on `did-finish-load`, `.once`→`.on` so it refreshes after reload → Task 4. ✅
- Strictly-newer comparison + dedup + null-safety → Task 3 (`shouldNotifyUpdate`), unit-tested. ✅
- Bridge channels `updateAvailable` (main→remote) + `reloadRequest` (remote→main) + `UpdateBannerPayload` → Task 2. ✅
- Banner rendered by preload with Reload button (→ `reloadRequest`) + dismiss → Task 5. ✅
- Reload handled in main via `webContents.reload()` → Task 4 (`ipcMain.on(BRIDGE.reloadRequest)`). ✅
- Localized `update-available` + `reload`, 7 locales → Task 1. ✅
- `/info` failure → no banner (null-safe) → Task 3 + Task 4 try/catch. ✅
- YAGNI: no auto-reload, no background interval, no web-client change → not present. ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step has complete code; exact commands with expected output. ✅

**Type consistency:** `shouldNotifyUpdate({ loadedVersion, currentVersion, notifiedVersion })` identical in Task 3 (def) and Task 4 (call). `UpdateBannerPayload { message, reloadLabel }` identical in Task 2 (def), Task 4 (send), Task 5 (consume). `BRIDGE.updateAvailable` / `BRIDGE.reloadRequest` identical across Tasks 2/4/5. i18n codes `update-available` / `reload` identical across Tasks 1/4. ✅
