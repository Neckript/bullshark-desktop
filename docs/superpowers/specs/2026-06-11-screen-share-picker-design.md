# Screen Sharing with an In-App Source Picker — Design

**Date:** 2026-06-11
**Status:** Approved (brainstorming)
**Scope:** Make screen sharing work in the packaged desktop app by handling the
remote web app's `getDisplayMedia()` request with a custom in-app source picker.

## Problem

The Bullshark web app uses `navigator.mediaDevices.getDisplayMedia()` to share a
screen in voice channels. In Electron this **fails by default**: unless the main
process installs a `session.setDisplayMediaRequestHandler`, the request is denied,
so screen sharing is "not compatible" in the desktop app. (Microphone/camera work
because Electron grants `getUserMedia` by default.) The codebase currently has no
media/capture handling at all.

## Decisions (locked during brainstorming)

- **Custom in-app picker** (not the OS system picker, not auto-select): when the web
  app requests screen share, show our own window listing available **screens AND
  windows** with thumbnails; the user clicks one. Robust across all OS versions and
  visually consistent.
- **Video only for v1.** System/loopback audio is a deferred follow-up.
- **One request at a time.** A new request while the picker is open is denied.
- Cancel/close denies the request cleanly (the web app handles the rejection).

## Architecture

The capture lives in the main process; the picker is a local renderer window (same
mechanism as onboarding/servers). Pure mapping/selection logic is extracted so it is
unit-testable without Electron.

```
src/main/screen-share.ts        installScreenShareHandler(session); pending state;
                                 toSourceDto(); pickSourceById(); choose()/cancel()
src/main/windows/picker-window.ts  open a local '/share-picker' window, parented to
                                   the server window, centered, ~720x520
src/renderer/pages/SharePicker.tsx the picker UI (thumbnail grid + Cancel)
src/renderer/router.tsx          add the '/share-picker' route
src/shared/ipc.ts                screen:sources, screen:pick, screen:cancel channels
src/preload/shell.ts             window.shell.screen = { getSources, choose, cancel }
src/renderer/shell.d.ts          types for the above
src/main/windows/main-window.ts  install the handler on the server window's session
```

### 1. Main: `src/main/screen-share.ts` (new)

- `installScreenShareHandler(session: Session)` calls
  `session.setDisplayMediaRequestHandler((request, callback) => { ... })`.
- On a request:
  - If a request is already pending → deny the new one (`callback({})`).
  - `desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize:
    { width: 320, height: 180 }, fetchWindowIcons: true })`.
  - Store `{ callback, sources }` module-level (single pending).
  - Open the picker window (parented to the requesting window).
- `getSourceDtos(): SourceDto[]` returns the stored sources mapped via `toSourceDto`.
- `choose(id: string)`: look up the source with `pickSourceById(sources, id)`; if
  found, `callback({ video: source })`; clear state; close the picker.
- `cancel()`: `callback({})` (deny); clear state; close the picker.
- **Pure helpers (unit-tested):**
  - `toSourceDto(source)` → `{ id, name, thumbnailDataUrl, appIconDataUrl? }`
    (`source.thumbnail.toDataURL()`, `appIcon?.toDataURL()`).
  - `pickSourceById(sources, id)` → the matching source or `undefined`.

`SourceDto = { id: string; name: string; thumbnailDataUrl: string; appIconDataUrl?: string }`.

### 2. Picker window: `src/main/windows/picker-window.ts` (new)

- `openSharePicker(parent: BrowserWindow)` creates a `BrowserWindow` with the shell
  preload, `parent`, `modal: false`, `resizable: false`, centered, ~720×520, and
  loads the local renderer at route `/share-picker` (reusing the existing
  dev-URL / `loadFile(join(import.meta.dirname,'../renderer/index.html'))` pattern
  from `local-renderer.ts`).
- `closeSharePicker()` closes it if open. The module keeps the single picker ref.
- If the picker is closed by the user (window 'close') without a choice, treat it as
  cancel.

### 3. Renderer: `src/renderer/pages/SharePicker.tsx` (new) + route

- On mount, `const sources = await window.shell.screen.getSources()`.
- Render a grid of cards: thumbnail (`thumbnailDataUrl`) + name (+ app icon for
  windows). Click → `window.shell.screen.choose(source.id)`.
- A **Cancel** button and Escape key → `window.shell.screen.cancel()`.
- `router.tsx`: add `if (hash.startsWith('/share-picker')) return <SharePicker />;`.

### 4. IPC + preload

- `src/shared/ipc.ts` `IPC`: add `screenSources: 'screen:sources'`,
  `screenPick: 'screen:pick'`, `screenCancel: 'screen:cancel'`.
- `src/preload/shell.ts`: expose
  `screen: { getSources: () => ipcRenderer.invoke(IPC.screenSources),
             choose: (id) => ipcRenderer.invoke(IPC.screenPick, id),
             cancel: () => ipcRenderer.invoke(IPC.screenCancel) }`.
- `src/renderer/shell.d.ts`: type `screen` accordingly (`getSources(): Promise<SourceDto[]>`).
- `src/main/ipc.ts` (or screen-share registration): handle the three channels by
  delegating to `getSourceDtos()`, `choose(id)`, `cancel()`.

### 5. Wiring

- In `src/main/windows/main-window.ts`, after creating the server `BrowserWindow`,
  call `installScreenShareHandler(mainWindow.webContents.session)` once.

## Error / edge handling

- Pending request already exists → deny the new request.
- Picker closed without a choice → cancel (deny).
- `choose(id)` with an unknown id → treat as cancel (deny), close picker.
- All handler work wrapped so a failure denies rather than throws.
- macOS only: first capture triggers the OS Screen Recording permission prompt
  (no code needed). Windows needs no special permission.

## Testing

- `toSourceDto` — maps id/name and produces data URLs from a fake source
  (`thumbnail.toDataURL()` / `appIcon.toDataURL()` stubbed); omits `appIconDataUrl`
  when there is no app icon.
- `pickSourceById` — returns the matching source; `undefined` for an unknown id.
- Session handler, picker window, and `SharePicker.tsx` — typecheck + manual smoke
  (start a screen share in a voice channel, confirm the picker lists screens and
  windows, pick one, confirm sharing starts; cancel denies cleanly). No renderer
  unit harness exists, consistent with #1/#2.

## Out of scope (deferred)

- System/loopback **audio** capture with the screen (`callback({ audio: 'loopback' })`).
- The OS-native system picker (`useSystemPicker`).
- Per-source live previews / refresh while the picker is open.
- Remembering the last chosen source.
