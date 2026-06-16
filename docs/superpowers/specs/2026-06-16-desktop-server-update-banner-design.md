# Desktop "Server Update Available → Reload" Banner — Design

**Date:** 2026-06-16
**Repo:** bullshark-desktop (Electron wrapper)
**Status:** Approved design, ready for implementation plan

## Problem

The desktop loads each server's UI directly from the remote origin (`mainWindow.loadURL(server.url)` in `src/main/windows/main-window.ts`). Closing the window only **hides it to tray** (`close` → `preventDefault()` + `hide()`); re-showing it does `show()/focus()` with **no re-navigation**. So after an operator deploys a new server build, a desktop user keeps seeing the **old, already-loaded UI** until they fully quit and relaunch (or switch servers). The web browser, by contrast, picks up the new build on the next reload.

Concrete symptom that motivated this: a new owner-only "Backup" tab appeared in the web client but not in the desktop app for the same owner account — because the desktop window was still showing the pre-deploy page.

## Goal

When the connected server has been updated to a **newer version than the page currently loaded** in the desktop window, show a small, non-intrusive banner offering to reload — so the user gets the new UI without a full app restart, and **without** interrupting their session unprompted.

## Non-goals (YAGNI)

- No automatic reload (never reload the chat out from under the user — could drop a voice call, lose scroll/compose state).
- No background polling interval. Detection happens **on window focus** only (the user's actual scenario: deploy, then return to the app).
- No changes to the bullshark web client (`apps/client`). A web-side version-aware reload prompt is a possible **future** cross-cutting improvement, explicitly out of scope here.
- No "downgrade" handling — only a strictly newer server version triggers the banner.

## Approach (chosen)

**Main process drives detection; the existing bridge preload renders the banner.** This reuses all current infrastructure:

- `fetchServerInfo(baseUrl)` (`src/main/servers/server-info.ts`) → `{ version } | null` from `/info`.
- `compareVersions(a, b)` (`src/main/servers/version.ts`).
- The `BRIDGE.*` IPC channels + the `bridge` preload's DOM-injected banner (`src/preload/bridge.ts`), styled exactly like the existing compatibility banner.
- The i18n catalogue `t(code, locale)` (`src/shared/i18n/messages.ts`).

Rejected alternatives:
- **Preload-driven polling** (preload fetches `/info` from the page and self-reloads): duplicates logic already in main, runs under the remote page's origin, harder to unit-test. Rejected.
- **Web-companion-driven** (the bullshark client detects and prompts): broader scope, touches another repo, and the user specifically wants the desktop fixed. Deferred as a future idea.

## Flow

1. `openServerWindow(server)` creates the window and `loadURL(server.url)` as today.
2. On `mainWindow.webContents` **`did-finish-load`**: capture the page's version baseline — `loadedVersion = (await fetchServerInfo(server.url))?.version ?? null`. Store it per-window and reset `notifiedVersion = null` (see dedup). **Important:** the existing handler uses `.once('did-finish-load', …)` (to send the compat banner once); this must become `.on('did-finish-load', …)` so the baseline is re-captured **after a reload** (otherwise `loadedVersion` stays stale and the banner can't clear). Re-sending the compat banner on each load is harmless. Keep the existing `sendCompatBanner` call in the same handler.
3. On the window's **`focus`** event (throttled to at most once per 30 s): run the update check.
4. **Update check** (`src/main/servers/update-check.ts`, pure & unit-tested): given `loadedVersion`, a freshly fetched `currentVersion`, and the last `notifiedVersion`, decide whether to notify. Notify iff:
   - `currentVersion !== null` (fetch succeeded), AND
   - `loadedVersion !== null`, AND
   - `compareVersions(currentVersion, loadedVersion) > 0` (strictly newer), AND
   - `currentVersion !== notifiedVersion` (not already notified for this exact version — dedup).
5. If it decides to notify: main sends `BRIDGE.updateAvailable` to the window with localized strings `{ message, reloadLabel }` (resolved via `t('update-available', locale)` and `t('reload', locale)`, `locale = resolveLocale(app.getLocale())`), and records `notifiedVersion = currentVersion`.
6. The **bridge preload** receives `BRIDGE.updateAvailable` and injects a banner (same visual treatment as the compat banner) containing the message, a **Reload** button, and a dismiss `✕`.
7. **Reload button** → `ipcRenderer.send(BRIDGE.reloadRequest)`. Main handles it with `win.webContents.reload()`. (Main owns navigation; chosen over `location.reload()` from the preload for a clean, testable control path.)
8. After reload, `did-finish-load` fires again → `loadedVersion` updates to the new version, `notifiedVersion` resets → the banner condition is naturally cleared.

**Dismiss behavior:** dismissing (`✕`) just removes the banner DOM. Because `notifiedVersion` was set, it will not re-appear for the same version on subsequent focuses; it re-appears only if an even newer version ships (or after a reload baseline change).

**Failure handling:** if `fetchServerInfo` returns `null` (server down, restarting mid-deploy, untrusted cert), the check is a no-op — no banner, no false positive. Mirrors the compat banner's intentional silent degradation.

## Components / files

| File | Change |
|------|--------|
| `src/shared/bridge.ts` | Add `updateAvailable: 'bridge:update-available'` (main→remote) and `reloadRequest: 'bridge:reload-request'` (remote→main). |
| `src/shared/types.ts` | Add `UpdateBannerPayload = { message: string; reloadLabel: string }`. |
| `src/main/servers/update-check.ts` | **New.** Pure decision helper `shouldNotifyUpdate({ loadedVersion, currentVersion, notifiedVersion }): boolean`. Depends only on `compareVersions`. Unit-tested. |
| `src/main/windows/main-window.ts` | Store per-window `{ loadedVersion, notifiedVersion, lastCheckAt }`; set `loadedVersion`/reset on `did-finish-load`; add throttled `focus` handler that calls `fetchServerInfo` + `shouldNotifyUpdate` and, if true, sends `BRIDGE.updateAvailable` (localized) and records `notifiedVersion`; add `ipcMain.on(BRIDGE.reloadRequest, …)` → `webContents.reload()`. |
| `src/preload/bridge.ts` | Add `ipcRenderer.on(BRIDGE.updateAvailable, …)` → inject an update banner (mirrors `showCompatBanner`) with a Reload button (`ipcRenderer.send(BRIDGE.reloadRequest)`) and dismiss. |
| `src/shared/i18n/messages.ts` | Add codes `update-available` and `reload` to `ERROR_CODES` + `MESSAGES` with all 7 locales (en, fr, es, it, ru, zh, cs). |

## Constants

- **Focus throttle:** 30 s (`UPDATE_CHECK_THROTTLE_MS = 30_000`). At most one `/info` fetch per 30 s regardless of focus churn (alt-tabbing).
- Reuses `fetchServerInfo`'s existing 4 s timeout.

## Error handling

- `/info` fetch failure → `null` → no notification (silent).
- Reload IPC is fire-and-forget; if the window is destroyed when it arrives, guard with `win.isDestroyed()` before `reload()`.
- The `focus` handler must never throw into Electron's event path (wrap like `sendCompatBanner` does).

## Testing

- **Unit (vitest), `update-check.test.ts`** — exhaustive truth table for `shouldNotifyUpdate`:
  - newer current vs loaded, not yet notified → `true`
  - equal → `false`; older → `false`
  - `currentVersion === null` → `false`; `loadedVersion === null` → `false`
  - newer but `currentVersion === notifiedVersion` (dedup) → `false`
  - newer than loaded AND newer than a stale `notifiedVersion` → `true`
- **i18n**: existing `locales.test.ts`/`messages.test.ts` style — assert the two new codes exist for every locale (no missing translations).
- **Wiring** (window focus handler, preload banner injection, reload IPC) is thin and covered by a manual smoke test: deploy a newer server build, focus the desktop window → banner appears → Reload → new UI; dismiss → no re-show until a newer version.

## Localized copy (en source; translate the 6 others during implementation)

- `update-available`: "This server was updated. Reload to get the latest version."
- `reload`: "Reload"
