# Bullshark Desktop — Design Spec

**Date:** 2026-06-10
**Repo:** `github.com/Neckript/bullshark-desktop` (separate from `bullshark`)
**Status:** Approved design — pending implementation plan

## Summary

A cross-platform **Electron wrapper** for the self-hosted Bullshark web app (React + Vite,
served from each user's own VPS). The desktop app contains **no server code** — it loads a
user-configured Bullshark instance URL over HTTP(S). It adds native desktop capabilities:
system tray with quick mute, native notifications, multi-server switching, and auto-update
via GitHub Releases.

**No hardcoded URL** — every user points the app at their own server, configured on first launch.

## Goals

- Wrap one or more user-configured Bullshark instances in a native desktop shell.
- System tray with quick **mute notifications (DND)** and **mute microphone** (in voice).
- Native OS notifications.
- Auto-update from GitHub Releases.
- Builds: Windows x64, macOS universal (Intel + Apple Silicon), Linux x64.
- First-launch onboarding to configure the server URL; reconfigurable later.
- Multiple Bullshark instances with a server switcher; isolated sessions per server.

## Non-Goals (YAGNI)

- No bundled/embedded Bullshark server.
- No code sharing with the `bullshark` repo (communication is over HTTP only).
- No code signing in v1 (designed to add later without rework — see Auto-Update).
- No proxying/modifying Bullshark's own content security policy or app logic beyond the
  one small cooperation hook (see "Bullshark web app coordination").

## Key Decisions (validated)

| Decision | Choice |
|----------|--------|
| Tooling | **electron-vite + electron-builder + electron-updater**, TypeScript, ESM |
| Window model | **One full-bleed window for the active server + tray/menu switcher** |
| Session isolation | **One Electron partition per server** (`persist:server-<id>`) |
| Preload surfaces | **Two**: `shell` (local pages) + `bullshark` (remote-content bridge) |
| Mute | **Both** notifications (DND) and microphone (voice) |
| Code signing | **None for now** (graceful degradation; future-proofed) |
| Instances | **Multiple** servers with a switcher |

> electron-builder is chosen over Electron Forge because Forge's hosted updater
> (`update.electronjs.org`) requires code signing even on Windows; electron-updater
> auto-updates unsigned NSIS/AppImage builds straight from GitHub Releases.

## Section 1 — Modern Electron (2025) baseline

**Process model:** `main` (Node, trusted core) · `preload` (contextBridge-only trust bridge,
injected into both local and remote content) · `renderer` (web content — our local pages and
the remote Bullshark instance).

**Security baseline (mandatory; we load remote content):**
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`
- IPC only via `contextBridge`; no Node objects exposed to the renderer
- Navigation guards: `will-navigate` + `setWindowOpenHandler` → external links open in the
  system browser; navigation outside the configured origin is blocked
- Strict CSP on our local pages; remote content keeps the CSP served by Bullshark
- No `@electron/remote`

**Tooling/layout:** TypeScript + ESM. electron-vite bundles `main`/`preload`/`renderer`
separately (`out/`), HMR on the local renderer. electron-builder reads `electron-builder.yml`
(targets, `publish: github`, macOS universal, update feeds). electron-updater consumes those
feeds. CI: GitHub Actions matrix (`windows-latest`, `macos-latest`, `ubuntu-latest`).

**Guiding principle:** main is the trusted core; the renderer — especially remote content — is
untrusted and gets a narrow, validated IPC surface.

## Section 2 — Repository structure

```
bullshark-desktop/
├── electron.vite.config.ts
├── electron-builder.yml
├── package.json
├── tsconfig.json (+ node/web variants)
├── .github/workflows/release.yml
├── build/                         # packaging resources (icons, tray states)
├── resources/                     # runtime assets (notification logo, etc.)
└── src/
    ├── main/
    │   ├── index.ts               # lifecycle, window, single-instance lock
    │   ├── windows/{main-window.ts, servers-window.ts}
    │   ├── tray.ts
    │   ├── servers/{store.ts, session.ts}
    │   ├── notifications.ts
    │   ├── voice-bridge.ts
    │   ├── updater.ts
    │   ├── ipc.ts
    │   └── navigation.ts
    ├── preload/{shell.ts, bridge.ts}
    └── renderer/                  # LOCAL pages only (not the web app)
        ├── index.html / main.tsx
        ├── pages/{Onboarding.tsx, Servers.tsx}
        ├── components/
        └── styles/
```

- `src/main` holds the bulk of the app.
- **Two preloads**: `shell.ts` (rich API for trusted local pages) and `bridge.ts` (minimal
  `window.bullshark` injected into the remote Bullshark page).
- `src/renderer` contains only local screens (onboarding, server management); the Bullshark
  app is loaded via `loadURL(serverUrl)`, never bundled.
- `electron-store` persists the server list + prefs in `userData`.

## Section 3 — Processes, components & IPC contract

**Main responsibilities:** single-instance lock; create/manage the active-server window and the
Servers window; tray + menu; notification DND state; mic-mute state; electron-store; updater;
navigation guards; all IPC handlers with **validated payloads** (URLs, ids).

**`window.shell`** (exposed to local pages):
```
shell.servers.list() / add(url,label) / update(id,…) / remove(id) / switchTo(id)
shell.servers.validateUrl(url)
shell.prefs.get() / set(...)
shell.onServersChanged(cb)
```

**`window.bullshark`** (minimal surface injected into the remote Bullshark page):
```
bullshark.isDesktop: true
bullshark.notifications.isMuted()
bullshark.voice.reportState({ muted })
bullshark.voice.onToggleRequest(cb)
bullshark.onMuteChanged(cb)
```

**Primary flows:**
- **Native notifications:** Bullshark already calls `new Notification()`, which Electron renders
  natively for free. **DND suppression cannot be done by overriding `window.Notification` in the
  preload** — under `contextIsolation: true` the preload's globals are isolated from the page's,
  so the override has no effect. Instead the web app (companion change) checks
  `window.bullshark.notifications.isMuted()` before calling `new Notification()`. The bridge keeps
  the mute state (`setMuted` from main) and exposes `isMuted()` / `onMuteChanged`.
- **Mic mute (tray → web):** tray click → IPC → `bridge` → `voice.onToggleRequest` → web app
  toggles its mediasoup mic → `voice.reportState({muted})` → main updates tray icon/label.
- **Notification click → focus:** the web app's notification `onclick` calls
  `window.bullshark.focusWindow()` → IPC → main shows/focuses the window.
- **Switch server:** Servers page → `shell.servers.switchTo(id)` → main reloads the window on
  that server's URL + partition.

**Validation:** server ids checked against the store; URLs normalized and restricted to
http(s) before `loadURL`.

## Section 4 — Data flow, server store & first launch

**electron-store (`userData`):**
```
servers: [ { id, label, url, lastUsedAt } ]
prefs: { activeServerId, notificationsMuted, launchOnStartup, lastWindowBounds }
```
Per-server isolation: each server ⇒ `partition: persist:server-<id>` (cookies, `localStorage`
incl. the Bullshark `AUTO_LOGIN_TOKEN`, cache). Switching never mixes sessions; each stays
independently logged in.

**Startup decision:**
```
app ready
 ├─ servers empty?  → Onboarding window
 └─ else            → load activeServerId (or most-recent) in the main window
```

**Onboarding flow:**
```
1. enter URL (e.g. https://chat.example.com)
2. normalize (scheme, trailing slash, reject non-http(s))
3. validateUrl() → light reachability probe (short timeout)
     ├─ ok    → save server, set active, load main window
     └─ fail  → clear error (unreachable / not a Bullshark instance / bad HTTPS)
4. add more servers later via the Servers window
```

Removing a server optionally purges its partition (clean logout).

**Open question (URL validation):** `validateUrl` does a light GET against the instance
(root or a health endpoint) with a short timeout to confirm reachability and that it looks
like Bullshark. To be finalized in the plan: check whether the Bullshark server exposes a
dedicated health/handshake endpoint; otherwise fall back to a root GET + response check.

## Section 5 — Tray, mute & native notifications

**Tray menu:**
```
Bullshark — <active server label>
─────────────
🔔 Notifications: On / Muted        (DND toggle)
🎤 Microphone: On / Muted           (toggle; enabled only when in voice)
─────────────
Servers ▸  ● Server A  ○ Server B  …  +  Manage servers…
─────────────
Show Bullshark  |  Quit
```
- Left-click tray → show/focus window. **Closing the window** hides to tray (does not quit);
  Quit is explicit via the menu.
- **3 icon states** (dedicated assets): normal · notifications-muted · mic-muted (mic-muted
  takes visual priority during a call).

**Notifications DND** (companion web change): persistent `notificationsMuted` lives in main and
is pushed to the bridge (`setMuted`); the bridge exposes `notifications.isMuted()` /
`onMuteChanged`. Because `contextIsolation` prevents the preload from overriding the page's
`Notification`, the **web app consults `window.bullshark.notifications.isMuted()` before emitting
a notification** (feature-detected; inert in a normal browser). The tray toggle flips the state.

**Mic mute** (companion web change): tray toggle → IPC → `bridge` →
`voice.onToggleRequest` → web app toggles mediasoup mic → `voice.reportState` → main updates
icon/label. When not in voice, the mic entry is disabled (web app reports no voice session).

**Native notifications:** rendered natively automatically by Electron. Notification click →
focus: the web app's notification `onclick` calls `window.bullshark.focusWindow()` → main shows/
focuses the window. Correct app name/icon per platform (Windows AppUserModelID set).

## Section 6 — Auto-update

Single source: **GitHub Releases** of `bullshark-desktop` (electron-builder publishes artifacts
+ `latest*.yml` feeds on tag).

| Platform | Auto-update (unsigned) | Detail |
|----------|------------------------|--------|
| Windows (NSIS) | ✅ works | electron-updater downloads + applies. SmartScreen warning on first install only. |
| Linux (AppImage) | ✅ works | electron-updater auto-update. (`.deb` also shipped, manual update.) |
| macOS | ❌ blocked unsigned | Squirrel.Mac requires signed+notarized. **Fallback:** query GitHub Releases API; if newer, notify + open the release page for manual download. Gatekeeper: first run needs right-click → Open (documented). |

**Update flow (Win/Linux):** check on launch + periodically → download in background → notify
"update ready — restart to apply" → applied on next quit or "Restart now". No forced
interruption; no downgrade.

**macOS fallback:** check Releases → newer? → notification → click opens release page.

**Abstraction:** `updater.ts` exposes a common interface (`checkForUpdates`, events) with two
implementations (electron-updater / github-fallback) selected by platform + signing capability.
Adding certs later (sign+notarize mac build) activates the native updater **without other code
changes**.

## Section 7 — Build, targets & release CI

| OS | Format | Arch |
|----|--------|------|
| Windows | NSIS installer + `latest.yml` | x64 |
| macOS | DMG + ZIP (ZIP feeds updater) | universal (Intel + Apple Silicon) |
| Linux | AppImage (auto-update) + `.deb` | x64 |

- `publish: github` → electron-builder pushes artifacts + feeds to the release.
- `appId` (e.g. `fr.bullshark.desktop`), Windows AppUserModelID, versioned artifact names.
- No signing block yet (future: `mac.notarize` + Windows cert, no other changes).

**Release CI (`.github/workflows/release.yml`):** trigger on `v*` tag; matrix
`windows-latest`/`macos-latest`/`ubuntu-latest`; each runner: checkout → setup node + cache →
install → build → `electron-builder --publish always`. Version comes from the tag (semver).
`GITHUB_TOKEN` suffices to publish (no signing secrets while unsigned).

**Dev workflow:** `dev` (electron-vite HMR) · `build` (local bundle) · `typecheck` · `lint` ·
`dist` (local unpublished artifact for testing). Full Windows build not required locally — CI
matrix handles all three OSes.

## Bullshark web app coordination (separate repo)

The wrapper requires a **small, feature-detected** companion addition in the `bullshark` web
repo, covering three things (all gated on `window.bullshark?.isDesktop`, inert in a normal
browser where `window.bullshark` is `undefined`):

- **Mic mute:** in a voice session, call `window.bullshark.voice.reportState({ muted })` on
  mic-state changes, and register `window.bullshark.voice.onToggleRequest(() => toggleMic())`.
- **Notification DND:** check `window.bullshark.notifications.isMuted()` before calling
  `new Notification()` (and skip the notification sound when muted).
- **Notification click → focus:** call `window.bullshark.focusWindow()` in the notification's
  `onclick` handler.

This is additive and inert in a normal browser. It will be specced/planned as a small companion
change to `bullshark` (its own spec → plan cycle). The desktop side ships the `window.bullshark`
surface (incl. `focusWindow`) regardless; the features light up once the companion change lands.

## Error handling & edge cases

- **Unreachable server** at launch: show a retry screen (don't hard-fail to a blank window);
  offer "edit server / switch server".
- **Bad/expired session**: the remote app handles its own auth; the wrapper just reloads the
  configured URL.
- **Invalid URL** in onboarding: blocked at validation with a clear message.
- **Offline**: detect and show an offline state with retry.
- **Removing the active server**: switch to another (or back to onboarding if none remain).
- **Second app instance**: single-instance lock focuses the existing window.

## Open questions to resolve during planning

1. Bullshark health/validation endpoint for `validateUrl` (else root GET).
2. Exact shape of the `window.bullshark` voice bridge vs. the web app's current mediasoup mute
   API (drives the companion change in `bullshark`).
3. Whether to show per-server unread badges in the tray/switcher (likely v2 — YAGNI for v1).
