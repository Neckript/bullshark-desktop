# Bullshark Desktop

A desktop wrapper for self-hosted [Bullshark](https://github.com/Neckript/bullshark) instances. There is no bundled server and no hardcoded URL — you point the app at your own Bullshark server.

## First run

On first launch an onboarding screen asks for your Bullshark instance URL (e.g. `https://chat.example.com`). The app validates the URL, saves it, and opens your server full-screen in its own isolated browser session.

To add, switch between, or remove servers open **Servers** from the tray menu. Each server keeps its own login session (separate cookie jar / localStorage partition), so you can be signed into multiple instances simultaneously.

## Tray

Bullshark Desktop lives in the system tray. Closing the main window hides it — use **Quit** in the tray menu to exit.

| Tray action | What it does |
|---|---|
| Click icon | Show / focus the main window |
| Notifications toggle | Mute or unmute desktop notifications (DND) |
| Microphone toggle | Mute / unmute your mic while in a voice channel |
| Servers submenu | Switch the active server (reopens the main window) |
| Manage servers… | Open the Servers window to add / remove entries |
| Show Bullshark | Bring the main window to front |
| Quit | Exit the app |

## macOS note (important — v1 builds are unsigned)

Because v1 builds are not code-signed or notarized, Gatekeeper blocks the first launch. To open the app:

1. Right-click `Bullshark Desktop.app` in Finder.
2. Click **Open**.
3. Confirm in the dialog.

You only need to do this once.

Auto-update via Squirrel requires a signed + notarized build, so **auto-update is disabled on macOS**. When a new release is available the app shows a notification and opens the GitHub Releases page so you can download the new version manually.

Windows and Linux auto-update normally via electron-updater. On Windows, SmartScreen may warn on first install because the executable is not yet widely known — click **More info → Run anyway** to proceed.

## Companion requirement

Three features require a small companion change in the Bullshark web app (it feature-detects `window.bullshark` exposed by the desktop preload):

- **Notification DND** — the web app must call `window.bullshark.notifications.isMuted()` before creating a `Notification`.
- **Mic mute** — the web app must call `window.bullshark.voice.reportState()` and handle `onToggleRequest`.
- **Notification click → focus** — the web app must call `window.bullshark.focusWindow()` from the notification `onclick` handler.

Until that companion change lands in the Bullshark repo, the desktop shell, server switching, and native notifications work normally; the three behaviors above are inert.

## Develop

```
npm install
npm run dev        # electron-vite with HMR — opens the app
npm test           # vitest unit tests
npm run typecheck  # tsc (main + renderer)
npm run lint       # eslint flat config
npm run build      # electron-vite production build → out/
npm run dist       # package for the current OS → dist/
```

## Release

Push a tag of the form `vX.Y.Z` (e.g. `v1.0.0`) to trigger the GitHub Actions release workflow. The matrix builds for Windows, macOS, and Linux, then uploads artifacts to GitHub Releases. `electron-updater` on Windows and Linux picks up the feed automatically on the next check interval (every 6 hours).
