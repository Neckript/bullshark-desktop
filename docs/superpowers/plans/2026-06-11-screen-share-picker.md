# Screen Sharing with In-App Source Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `getDisplayMedia()` work in the desktop app by installing a display-media request handler that opens a custom in-app picker of screens and windows and shares the chosen source.

**Architecture:** The main process installs `session.setDisplayMediaRequestHandler` on the server window's session; on a request it fetches sources via `desktopCapturer`, opens a local `/share-picker` renderer window, and resolves the request with the user's pick. Pure mapping/selection helpers are unit-tested; the Electron-bound parts are verified by typecheck + manual smoke.

**Tech Stack:** Electron 33, TypeScript, React, Vitest, electron-vite.

Spec: `docs/superpowers/specs/2026-06-11-screen-share-picker-design.md`

---

## File Structure

**Create:**
- `src/main/screen-share.ts` (+ `screen-share.test.ts`) — pure helpers + the handler/state.
- `src/main/windows/picker-window.ts` — open/close the `/share-picker` window.
- `src/renderer/pages/SharePicker.tsx` — the picker UI.

**Modify:**
- `src/shared/types.ts` — `SourceDto` type.
- `src/shared/ipc.ts` — `screenSources`/`screenPick`/`screenCancel` channels.
- `src/preload/shell.ts` — `window.shell.screen` API.
- `src/renderer/shell.d.ts` — types for `screen`.
- `src/renderer/router.tsx` — `/share-picker` route.
- `src/main/ipc.ts` — register the three screen IPC handlers.
- `src/main/windows/main-window.ts` — install the handler on the server session.

---

## Task 1: Pure helpers — source DTO mapping and selection

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/main/screen-share.ts`
- Test: `src/main/screen-share.test.ts`

- [ ] **Step 1: Add the SourceDto type**

Append to `src/shared/types.ts`:

```ts
export type SourceDto = {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  appIconDataUrl?: string;
};
```

- [ ] **Step 2: Write the failing test**

Create `src/main/screen-share.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { toSourceDto, pickSourceById } from './screen-share';

const img = (url: string, empty = false) => ({ isEmpty: () => empty, toDataURL: () => url });

describe('toSourceDto', () => {
  test('maps id, name and thumbnail data url', () => {
    const dto = toSourceDto({ id: 'screen:0', name: 'Screen 1', thumbnail: img('data:thumb') });
    expect(dto).toEqual({ id: 'screen:0', name: 'Screen 1', thumbnailDataUrl: 'data:thumb' });
  });
  test('includes appIconDataUrl when the app icon is non-empty', () => {
    const dto = toSourceDto({ id: 'win:1', name: 'App', thumbnail: img('data:t'), appIcon: img('data:icon') });
    expect(dto.appIconDataUrl).toBe('data:icon');
  });
  test('omits appIconDataUrl when the app icon is empty or absent', () => {
    expect(toSourceDto({ id: 'a', name: 'a', thumbnail: img('t'), appIcon: img('x', true) }).appIconDataUrl).toBeUndefined();
    expect(toSourceDto({ id: 'b', name: 'b', thumbnail: img('t'), appIcon: null }).appIconDataUrl).toBeUndefined();
    expect(toSourceDto({ id: 'c', name: 'c', thumbnail: img('t') }).appIconDataUrl).toBeUndefined();
  });
});

describe('pickSourceById', () => {
  test('returns the matching source', () => {
    const list = [{ id: 'a' }, { id: 'b' }];
    expect(pickSourceById(list, 'b')).toEqual({ id: 'b' });
  });
  test('returns undefined for an unknown id', () => {
    expect(pickSourceById([{ id: 'a' }], 'z')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- screen-share`
Expected: FAIL — cannot resolve `./screen-share`.

- [ ] **Step 4: Write the helpers**

Create `src/main/screen-share.ts`:

```ts
import type { SourceDto } from '../shared/types';

type CapturerSourceLike = {
  id: string;
  name: string;
  thumbnail: { toDataURL(): string };
  appIcon?: { isEmpty(): boolean; toDataURL(): string } | null;
};

export const toSourceDto = (s: CapturerSourceLike): SourceDto => {
  const dto: SourceDto = { id: s.id, name: s.name, thumbnailDataUrl: s.thumbnail.toDataURL() };
  if (s.appIcon && !s.appIcon.isEmpty()) dto.appIconDataUrl = s.appIcon.toDataURL();
  return dto;
};

export const pickSourceById = <T extends { id: string }>(sources: T[], id: string): T | undefined =>
  sources.find((s) => s.id === id);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- screen-share`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/main/screen-share.ts src/main/screen-share.test.ts
git commit -m "feat(screen-share): SourceDto + toSourceDto/pickSourceById helpers"
```

---

## Task 2: IPC channels, preload API, and renderer types

**Files:**
- Modify: `src/shared/ipc.ts`, `src/preload/shell.ts`, `src/renderer/shell.d.ts`

Verified by `npm run typecheck`.

- [ ] **Step 1: Add IPC channels**

In `src/shared/ipc.ts`, add to the `IPC` object (after `appLocale: 'app:locale'`, add a comma to that line):

```ts
  appLocale: 'app:locale',
  screenSources: 'screen:sources',
  screenPick: 'screen:pick',
  screenCancel: 'screen:cancel'
```

- [ ] **Step 2: Expose the screen API in the preload**

In `src/preload/shell.ts`, add the type import near the existing type import:

```ts
import type { Prefs, ServerEntry, SourceDto } from '../shared/types';
```

(adjust the existing `import type { ... } from '../shared/types'` line to include `SourceDto`; if `Locale` etc. are imported separately, leave those as-is).

Then add a `screen` block to the object passed to `contextBridge.exposeInMainWorld('shell', { ... })`, after the `prefs` block:

```ts
  screen: {
    getSources: (): Promise<SourceDto[]> => ipcRenderer.invoke(IPC.screenSources),
    choose: (id: string): Promise<void> => ipcRenderer.invoke(IPC.screenPick, id),
    cancel: (): Promise<void> => ipcRenderer.invoke(IPC.screenCancel)
  },
```

- [ ] **Step 3: Type it in the renderer global**

In `src/renderer/shell.d.ts`, add `SourceDto` to the shared-types import:

```ts
import type { ServerEntry, Prefs, SourceDto } from '../shared/types';
```

Add inside the `shell` interface (after the `prefs` block):

```ts
      screen: {
        getSources: () => Promise<SourceDto[]>;
        choose: (id: string) => Promise<void>;
        cancel: () => Promise<void>;
      };
```

- [ ] **Step 4: Verify types compile**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc.ts src/preload/shell.ts src/renderer/shell.d.ts
git commit -m "feat(screen-share): screen IPC channels + window.shell.screen API"
```

---

## Task 3: The picker window

**Files:**
- Create: `src/main/windows/picker-window.ts`

Verified by `npm run typecheck`.

- [ ] **Step 1: Create the picker window module**

Create `src/main/windows/picker-window.ts`:

```ts
import { BrowserWindow } from 'electron';
import { join } from 'node:path';

let picker: BrowserWindow | null = null;

// Opens (or focuses) the screen-share source picker, parented to the server
// window. `onClosed` fires when the picker closes for any reason — the caller
// uses it to treat a manual close as a cancel (idempotent if already resolved).
export const openSharePicker = (parent: BrowserWindow, onClosed: () => void): BrowserWindow => {
  if (picker && !picker.isDestroyed()) {
    picker.focus();
    return picker;
  }
  picker = new BrowserWindow({
    width: 720,
    height: 520,
    parent,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Share your screen',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: join(import.meta.dirname, '../preload/shell.cjs')
    }
  });
  picker.on('closed', () => {
    picker = null;
    onClosed();
  });
  const base = process.env.ELECTRON_RENDERER_URL;
  if (base) void picker.loadURL(`${base}#/share-picker`);
  else void picker.loadFile(join(import.meta.dirname, '../renderer/index.html'), { hash: '/share-picker' });
  return picker;
};

export const closeSharePicker = () => {
  if (picker && !picker.isDestroyed()) picker.close();
  picker = null;
};
```

- [ ] **Step 2: Verify types compile**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main/windows/picker-window.ts
git commit -m "feat(screen-share): local share-picker window"
```

---

## Task 4: The display-media handler and state

**Files:**
- Modify: `src/main/screen-share.ts`

Verified by `npm run typecheck`.

- [ ] **Step 1: Add the handler, state, and resolve/cancel to screen-share.ts**

In `src/main/screen-share.ts`, add these imports at the top (above the existing `import type { SourceDto }` line):

```ts
import { BrowserWindow, desktopCapturer, type Session, type DesktopCapturerSource } from 'electron';
import { openSharePicker, closeSharePicker } from './windows/picker-window';
```

Then append to the end of the file:

```ts
type DisplayMediaCallback = (streams: { video?: DesktopCapturerSource }) => void;

let pending: { callback: DisplayMediaCallback; sources: DesktopCapturerSource[] } | null = null;

// Installs the screen-share handler on a session. When the remote page calls
// getDisplayMedia(), fetch the sources and open the in-app picker; the picker
// resolves via chooseSource()/cancelShare(). One request at a time.
export const installScreenShareHandler = (session: Session, getParent: () => BrowserWindow | null) => {
  session.setDisplayMediaRequestHandler(async (_request, callback) => {
    const parent = getParent();
    if (pending || !parent) {
      callback({});
      return;
    }
    let sources: DesktopCapturerSource[];
    try {
      sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      });
    } catch {
      callback({});
      return;
    }
    pending = { callback, sources };
    openSharePicker(parent, cancelShare);
  });
};

export const getSourceDtos = (): SourceDto[] => (pending ? pending.sources.map(toSourceDto) : []);

export const chooseSource = (id: string) => {
  if (!pending) return;
  const source = pickSourceById(pending.sources, id);
  const { callback } = pending;
  pending = null;
  callback(source ? { video: source } : {});
  closeSharePicker();
};

export const cancelShare = () => {
  if (!pending) return;
  const { callback } = pending;
  pending = null;
  callback({});
  closeSharePicker();
};
```

- [ ] **Step 2: Verify types compile**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main/screen-share.ts
git commit -m "feat(screen-share): display-media handler with single-request state"
```

---

## Task 5: The picker UI and route

**Files:**
- Create: `src/renderer/pages/SharePicker.tsx`
- Modify: `src/renderer/router.tsx`

Verified by `npm run typecheck` + manual smoke (Task 6).

- [ ] **Step 1: Create the picker page**

Create `src/renderer/pages/SharePicker.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { SourceDto } from '../../shared/types';

export const SharePicker = () => {
  const [sources, setSources] = useState<SourceDto[]>([]);

  useEffect(() => {
    void window.shell.screen.getSources().then(setSources);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void window.shell.screen.cancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <h3 style={{ marginTop: 0 }}>Share your screen</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, maxHeight: 380, overflow: 'auto' }}>
        {sources.map((s) => (
          <button
            key={s.id}
            onClick={() => void window.shell.screen.choose(s.id)}
            style={{ textAlign: 'left', padding: 8, cursor: 'pointer', border: '1px solid #ccc', borderRadius: 6, background: '#fff' }}
          >
            <img src={s.thumbnailDataUrl} alt="" style={{ width: '100%', height: 120, objectFit: 'contain', background: '#000', borderRadius: 4 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12 }}>
              {s.appIconDataUrl && <img src={s.appIconDataUrl} alt="" style={{ width: 16, height: 16 }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            </div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <button onClick={() => void window.shell.screen.cancel()}>Cancel</button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add the route**

Replace the full contents of `src/renderer/router.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { Onboarding } from './pages/Onboarding';
import { Servers } from './pages/Servers';
import { SharePicker } from './pages/SharePicker';

export const Router = () => {
  const [hash, setHash] = useState(window.location.hash.replace('#', '') || '/onboarding');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash.replace('#', ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (hash.startsWith('/servers')) return <Servers />;
  if (hash.startsWith('/share-picker')) return <SharePicker />;
  return <Onboarding />;
};
```

- [ ] **Step 3: Verify types compile**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/pages/SharePicker.tsx src/renderer/router.tsx
git commit -m "feat(screen-share): in-app source picker UI + route"
```

---

## Task 6: Wire the handler and IPC, then verify

**Files:**
- Modify: `src/main/ipc.ts`, `src/main/windows/main-window.ts`

- [ ] **Step 1: Register the screen IPC handlers**

In `src/main/ipc.ts`, add this import near the other local imports:

```ts
import { getSourceDtos, chooseSource, cancelShare } from './screen-share';
```

Inside `registerIpc`, add alongside the other `ipcMain.handle(...)` calls:

```ts
  ipcMain.handle(IPC.screenSources, () => getSourceDtos());
  ipcMain.handle(IPC.screenPick, (_e, id: string) => chooseSource(id));
  ipcMain.handle(IPC.screenCancel, () => cancelShare());
```

- [ ] **Step 2: Install the handler on the server window's session**

In `src/main/windows/main-window.ts`, add the import near the other `../` imports:

```ts
import { installScreenShareHandler } from '../screen-share';
```

In `openServerWindow`, add the install call right after `applyNavigationGuards(...)` and before the `did-finish-load` registration:

```ts
  applyNavigationGuards(mainWindow.webContents, new URL(server.url).origin);
  installScreenShareHandler(mainWindow.webContents.session, getMainWindow);
  mainWindow.webContents.once('did-finish-load', () => {
    void sendCompatBanner(mainWindow!, server.url);
  });
```

- [ ] **Step 3: Verify the whole suite + types + lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 4: Manual smoke (recommended)**

Run: `npm run dev`, connect to a Bullshark server, join a voice channel, start a screen share. Expected: the picker window opens listing screens **and** windows with thumbnails; clicking one starts the share; Cancel / Escape / closing the window denies the request without crashing.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.ts src/main/windows/main-window.ts
git commit -m "feat(screen-share): install handler on server session + register IPC"
```

---

## Self-Review Notes

- **Spec coverage:** handler on the server session (Task 6), desktopCapturer screens+windows (Task 4), in-app picker window (Task 3) + UI (Task 5), one-request-at-a-time deny (Task 4), cancel on close/Escape/Cancel → deny (Tasks 3/4/5), pure helpers unit-tested (Task 1), IPC + preload + types (Task 2). Video-only (no audio in `callback`) — matches the v1 decision. macOS permission is OS-driven (no code). All covered.
- **No placeholders:** every step has concrete code.
- **Type consistency:** `SourceDto` (shared/types) used by `toSourceDto`, the preload `screen.getSources`, `shell.d.ts`, and `SharePicker`. Handler stores `DesktopCapturerSource[]`; `toSourceDto`'s `CapturerSourceLike` is structurally satisfied by `DesktopCapturerSource` (`thumbnail`/`appIcon` are `NativeImage` with `toDataURL`/`isEmpty`). Exported names `installScreenShareHandler`/`getSourceDtos`/`chooseSource`/`cancelShare` are used identically in `main/ipc.ts` and `main-window.ts`. Channels `screenSources`/`screenPick`/`screenCancel` match across `ipc.ts`, preload, and handlers.
- **Note:** `openSharePicker` is called with `cancelShare` as `onClosed`; after `chooseSource`/`cancelShare` clears `pending` and calls `closeSharePicker()`, the window's `closed` event re-invokes `cancelShare`, which is a no-op because `pending` is already `null`. No double-resolve.
