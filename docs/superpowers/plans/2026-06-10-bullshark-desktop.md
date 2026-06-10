# Bullshark Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform Electron desktop wrapper for self-hosted Bullshark instances — multi-server switcher with isolated sessions, tray mute (notifications + mic), native notifications, and GitHub-releases auto-update.

**Architecture:** A trusted Electron `main` process owns windows, tray, the server store (electron-store), IPC, and the updater. Two preloads expose narrow contextBridge APIs: `shell` to our local React pages (onboarding/servers), `bridge` to the remote Bullshark page (DND notification suppression + a voice-mute hook). The active server is loaded full-bleed via `loadURL` in a per-server session partition. No server code is bundled; no URL is hardcoded.

**Tech Stack:** Electron, electron-vite, electron-builder, electron-updater, electron-store, React + TypeScript (ESM), Vitest (pure-logic tests), GitHub Actions. Reference spec: `docs/superpowers/specs/2026-06-10-bullshark-desktop-design.md`.

---

## File Structure

**Config / root**
- `package.json`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- `electron.vite.config.ts` — bundles main/preload/renderer
- `electron-builder.yml` — targets, GitHub publish, mac universal
- `vitest.config.ts` — unit tests for pure logic
- `.github/workflows/release.yml`, `.github/workflows/ci.yml`
- `.gitignore`, `README.md`
- `build/` (icons + tray state assets), `resources/` (notification logo)

**Shared (imported by main + preload + renderer)**
- `src/shared/ipc.ts` — IPC channel name constants
- `src/shared/types.ts` — `ServerEntry`, `Prefs`, bridge message types

**Main** (`src/main/`)
- `index.ts` — app lifecycle, single-instance lock, startup decision
- `windows/main-window.ts` — active-server BrowserWindow
- `windows/servers-window.ts` — local "manage servers" window
- `windows/local-renderer.ts` — helper to load a local renderer route
- `servers/url.ts` — pure URL normalization + validation result types
- `servers/validate.ts` — reachability probe (network)
- `servers/store.ts` — electron-store CRUD for servers + prefs
- `servers/session.ts` — partition id + session hardening
- `tray.ts` — tray icon (3 states) + menu
- `notifications.ts` — DND state holder
- `voice-bridge.ts` — mic-mute state + toggle dispatch
- `updater/index.ts` — updater selection
- `updater/electron-updater-impl.ts`, `updater/github-fallback.ts`
- `ipc.ts` — registers all IPC handlers
- `navigation.ts` — will-navigate / window-open guards

**Preload** (`src/preload/`)
- `shell.ts` — `window.shell` for local pages
- `bridge.ts` — `window.bullshark` for the remote page

**Renderer** (`src/renderer/` — local pages only)
- `index.html`, `main.tsx`, `router.tsx`
- `pages/Onboarding.tsx`, `pages/Servers.tsx`
- `components/`, `styles/`

---

## Phase 0 — Scaffolding

### Task 1: Project scaffold that runs a window

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `electron.vite.config.ts`, `vitest.config.ts`, `.gitignore`
- Create: `src/main/index.ts`, `src/preload/shell.ts`, `src/renderer/index.html`, `src/renderer/main.tsx`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "bullshark-desktop",
  "version": "0.1.0",
  "description": "Desktop app for self-hosted Bullshark",
  "main": "./out/main/index.js",
  "type": "module",
  "author": "Neckript",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
    "test": "vitest run",
    "lint": "eslint .",
    "dist": "electron-vite build && electron-builder --publish never"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.1.0",
    "electron-vite": "^2.3.0",
    "eslint": "^9.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "electron-store": "^10.0.0",
    "electron-updater": "^6.3.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.node.json` (main + preload) and `tsconfig.web.json` (renderer)**

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "types": ["node"], "noEmit": true
  },
  "include": ["src/main", "src/preload", "src/shared", "electron.vite.config.ts"]
}
```
`tsconfig.web.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true, "noEmit": true
  },
  "include": ["src/renderer", "src/shared", "src/preload"]
}
```
`tsconfig.json`:
```json
{ "files": [], "references": [{ "path": "./tsconfig.node.json" }, { "path": "./tsconfig.web.json" }] }
```

- [ ] **Step 3: Create `electron.vite.config.ts`**

```ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: { build: { rollupOptions: { input: resolve('src/main/index.ts') } } },
  preload: {
    build: {
      rollupOptions: {
        input: {
          shell: resolve('src/preload/shell.ts'),
          bridge: resolve('src/preload/bridge.ts')
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } },
    plugins: [react()]
  }
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } });
```

- [ ] **Step 5: Create a minimal `src/main/index.ts` that opens a window**

```ts
import { app, BrowserWindow } from 'electron';

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile('out/renderer/index.html');
  }
};

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
```

- [ ] **Step 6: Create `src/preload/shell.ts` (stub), `src/preload/bridge.ts` (empty stub), `src/renderer/index.html`, `src/renderer/main.tsx`**

`src/preload/shell.ts`: `// shell preload — filled in Task 7`
`src/preload/bridge.ts`: `// remote bridge — filled in Task 8`
`src/renderer/index.html`:
```html
<!doctype html><html><head><meta charset="utf-8" /><title>Bullshark</title></head>
<body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>
```
`src/renderer/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(<h1>Bullshark Desktop</h1>);
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules/
out/
dist/
*.log
```

- [ ] **Step 8: Install + verify dev launches**

Run: `npm install && npm run dev`
Expected: an Electron window opens showing "Bullshark Desktop". Close it.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold electron-vite + react + typescript project"
```

---

## Phase 1 — Server store & config logic (TDD)

### Task 2: URL normalization (pure function, TDD)

**Files:**
- Create: `src/main/servers/url.ts`
- Test: `src/main/servers/url.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest';
import { normalizeServerUrl } from './url';

describe('normalizeServerUrl', () => {
  test('adds https when scheme missing', () => {
    expect(normalizeServerUrl('chat.example.com')).toEqual({ ok: true, url: 'https://chat.example.com' });
  });
  test('keeps http when explicit', () => {
    expect(normalizeServerUrl('http://localhost:4991')).toEqual({ ok: true, url: 'http://localhost:4991' });
  });
  test('strips trailing slash', () => {
    expect(normalizeServerUrl('https://a.com/')).toEqual({ ok: true, url: 'https://a.com' });
  });
  test('rejects empty', () => {
    expect(normalizeServerUrl('   ').ok).toBe(false);
  });
  test('rejects non-http(s) scheme', () => {
    expect(normalizeServerUrl('ftp://a.com').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- src/main/servers/url.test.ts`
Expected: FAIL ("normalizeServerUrl is not a function").

- [ ] **Step 3: Implement `url.ts`**

```ts
export type NormalizeResult = { ok: true; url: string } | { ok: false; reason: string };

export const normalizeServerUrl = (input: string): NormalizeResult => {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'scheme' };
  }

  const url = `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
  return { ok: true, url };
};
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/main/servers/url.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/servers/url.ts src/main/servers/url.test.ts
git commit -m "feat: server URL normalization with validation"
```

### Task 3: Server store + prefs (electron-store)

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/main/servers/store.ts`
- Test: `src/main/servers/store.test.ts`

- [ ] **Step 1: Define shared types in `src/shared/types.ts`**

```ts
export type ServerEntry = { id: string; label: string; url: string; lastUsedAt: number };

export type Prefs = {
  activeServerId: string | null;
  notificationsMuted: boolean;
  launchOnStartup: boolean;
  lastWindowBounds: { width: number; height: number; x?: number; y?: number } | null;
};

export const DEFAULT_PREFS: Prefs = {
  activeServerId: null,
  notificationsMuted: false,
  launchOnStartup: false,
  lastWindowBounds: null
};
```

- [ ] **Step 2: Write the failing test (store backed by an injectable map)**

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { createServerStore, type StoreBackend } from './store';

const memoryBackend = (): StoreBackend => {
  const data = new Map<string, unknown>();
  return {
    get: (k, d) => (data.has(k) ? (data.get(k) as never) : d),
    set: (k, v) => void data.set(k, v)
  };
};

describe('server store', () => {
  let store: ReturnType<typeof createServerStore>;
  beforeEach(() => { store = createServerStore(memoryBackend()); });

  test('add returns an entry and lists it', () => {
    const entry = store.add('https://a.com', 'A');
    expect(entry.url).toBe('https://a.com');
    expect(store.list()).toHaveLength(1);
  });
  test('first added server becomes active', () => {
    const entry = store.add('https://a.com', 'A');
    expect(store.getPrefs().activeServerId).toBe(entry.id);
  });
  test('switchTo updates active + lastUsedAt', () => {
    const a = store.add('https://a.com', 'A');
    const b = store.add('https://b.com', 'B');
    store.switchTo(a.id);
    expect(store.getPrefs().activeServerId).toBe(a.id);
    expect(store.list().find((s) => s.id === a.id)!.lastUsedAt).toBeGreaterThan(0);
    expect(b.id).not.toBe(a.id);
  });
  test('remove drops the server; active falls back to remaining', () => {
    const a = store.add('https://a.com', 'A');
    const b = store.add('https://b.com', 'B');
    store.switchTo(b.id);
    store.remove(b.id);
    expect(store.list().map((s) => s.id)).toEqual([a.id]);
    expect(store.getPrefs().activeServerId).toBe(a.id);
  });
  test('removing the last server clears active', () => {
    const a = store.add('https://a.com', 'A');
    store.remove(a.id);
    expect(store.getPrefs().activeServerId).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify failure**

Run: `npm test -- src/main/servers/store.test.ts`
Expected: FAIL ("createServerStore is not a function").

- [ ] **Step 4: Implement `store.ts`** (electron-store injected behind `StoreBackend` so it is testable)

```ts
import { randomUUID } from 'node:crypto';
import { DEFAULT_PREFS, type Prefs, type ServerEntry } from '../../shared/types';

export type StoreBackend = {
  get<T>(key: string, defaultValue: T): T;
  set(key: string, value: unknown): void;
};

export const createServerStore = (backend: StoreBackend) => {
  const listServers = (): ServerEntry[] => backend.get<ServerEntry[]>('servers', []);
  const getPrefs = (): Prefs => backend.get<Prefs>('prefs', DEFAULT_PREFS);
  const setPrefs = (patch: Partial<Prefs>) => backend.set('prefs', { ...getPrefs(), ...patch });

  const add = (url: string, label: string): ServerEntry => {
    const entry: ServerEntry = { id: randomUUID(), label, url, lastUsedAt: Date.now() };
    const servers = [...listServers(), entry];
    backend.set('servers', servers);
    if (getPrefs().activeServerId === null) setPrefs({ activeServerId: entry.id });
    return entry;
  };

  const update = (id: string, patch: Partial<Pick<ServerEntry, 'label' | 'url'>>) => {
    backend.set('servers', listServers().map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const switchTo = (id: string) => {
    backend.set('servers', listServers().map((s) => (s.id === id ? { ...s, lastUsedAt: Date.now() } : s)));
    setPrefs({ activeServerId: id });
  };

  const remove = (id: string) => {
    const remaining = listServers().filter((s) => s.id !== id);
    backend.set('servers', remaining);
    if (getPrefs().activeServerId === id) {
      const fallback = [...remaining].sort((a, b) => b.lastUsedAt - a.lastUsedAt)[0];
      setPrefs({ activeServerId: fallback ? fallback.id : null });
    }
  };

  const getActive = (): ServerEntry | null => {
    const id = getPrefs().activeServerId;
    return listServers().find((s) => s.id === id) ?? null;
  };

  return { list: listServers, add, update, switchTo, remove, getActive, getPrefs, setPrefs };
};
```

- [ ] **Step 5: Run test to verify pass**

Run: `npm test -- src/main/servers/store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Add the electron-store backend factory (not unit-tested — thin adapter)**

Append to `store.ts`:
```ts
import Store from 'electron-store';

export const electronStoreBackend = (): StoreBackend => {
  const store = new Store();
  return {
    get: (key, defaultValue) => store.get(key, defaultValue) as never,
    set: (key, value) => store.set(key, value)
  };
};
```

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/main/servers/store.ts src/main/servers/store.test.ts
git commit -m "feat: server + prefs store with active-server logic"
```

### Task 4: Server reachability probe

**Files:**
- Create: `src/main/servers/validate.ts`
- Test: `src/main/servers/validate.test.ts`

- [ ] **Step 1: Write the failing test (inject a fetch-like function)**

```ts
import { describe, expect, test } from 'vitest';
import { probeServer } from './validate';

describe('probeServer', () => {
  test('ok when fetch resolves with ok response', async () => {
    const res = await probeServer('https://a.com', async () => ({ ok: true, status: 200 }) as Response);
    expect(res.reachable).toBe(true);
  });
  test('unreachable when fetch throws', async () => {
    const res = await probeServer('https://a.com', async () => { throw new Error('ENOTFOUND'); });
    expect(res.reachable).toBe(false);
  });
  test('unreachable on 5xx', async () => {
    const res = await probeServer('https://a.com', async () => ({ ok: false, status: 502 }) as Response);
    expect(res.reachable).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- src/main/servers/validate.test.ts`
Expected: FAIL ("probeServer is not a function").

- [ ] **Step 3: Implement `validate.ts`**

```ts
export type ProbeResult = { reachable: boolean; status?: number; reason?: string };
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const probeServer = async (
  url: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 5000
): Promise<ProbeResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: 'GET', signal: controller.signal });
    if (res.status >= 500) return { reachable: false, status: res.status, reason: 'server-error' };
    return { reachable: true, status: res.status };
  } catch (e) {
    return { reachable: false, reason: e instanceof Error ? e.message : 'unknown' };
  } finally {
    clearTimeout(timer);
  }
};
```

> Note: the probe confirms reachability only. A dedicated Bullshark health endpoint (open question #1 in the spec) can tighten this later; root GET is the agreed fallback.

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/main/servers/validate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/servers/validate.ts src/main/servers/validate.test.ts
git commit -m "feat: server reachability probe"
```

---

## Phase 2 — Sessions, navigation & windows

### Task 5: Per-server session + navigation guards

**Files:**
- Create: `src/main/servers/session.ts`
- Create: `src/main/navigation.ts`
- Test: `src/main/servers/session.test.ts`

- [ ] **Step 1: Write the failing test for the pure partition helper**

```ts
import { describe, expect, test } from 'vitest';
import { partitionForServer } from './session';

describe('partitionForServer', () => {
  test('builds a persistent per-server partition', () => {
    expect(partitionForServer('abc')).toBe('persist:server-abc');
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- src/main/servers/session.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `session.ts`**

```ts
import { session, type Session } from 'electron';

export const partitionForServer = (serverId: string): string => `persist:server-${serverId}`;

export const sessionForServer = (serverId: string): Session =>
  session.fromPartition(partitionForServer(serverId));
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/main/servers/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `navigation.ts` (guards applied to a webContents)**

```ts
import { shell, type WebContents } from 'electron';

// Keep the user inside their configured origin; send everything else to the OS browser.
export const applyNavigationGuards = (contents: WebContents, allowedOrigin: string) => {
  contents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).origin !== allowedOrigin) {
        event.preventDefault();
        void shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });
};
```

- [ ] **Step 6: Commit**

```bash
git add src/main/servers/session.ts src/main/servers/session.test.ts src/main/navigation.ts
git commit -m "feat: per-server session partitions + navigation guards"
```

### Task 6: Main window loading the active server

**Files:**
- Create: `src/main/windows/main-window.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Implement `main-window.ts`**

```ts
import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import type { ServerEntry } from '../../shared/types';
import { applyNavigationGuards } from '../navigation';
import { partitionForServer } from '../servers/session';

let mainWindow: BrowserWindow | null = null;

export const getMainWindow = () => mainWindow;

export const showMainWindow = () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
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
        preload: join(import.meta.dirname, '../preload/bridge.js')
      }
    });
    mainWindow.once('ready-to-show', () => mainWindow?.show());
    // Close hides to tray (Task 9 wires the real quit path).
    mainWindow.on('close', (event) => {
      if (!(global as { isQuitting?: boolean }).isQuitting) {
        event.preventDefault();
        mainWindow?.hide();
      }
    });
  } else {
    // Switching servers requires a fresh partition → recreate.
    mainWindow.destroy();
    mainWindow = null;
    openServerWindow(server);
    return;
  }
  applyNavigationGuards(mainWindow.webContents, new URL(server.url).origin);
  void mainWindow.loadURL(server.url);
};
```

> Note: switching partitions requires a new `BrowserWindow` (partition is fixed at creation), hence the recreate path.

- [ ] **Step 2: Wire startup decision in `src/main/index.ts`**

```ts
import { app, BrowserWindow } from 'electron';
import { createServerStore, electronStoreBackend } from './servers/store';
import { openServerWindow } from './windows/main-window';
import { openOnboarding } from './windows/servers-window';

const store = createServerStore(electronStoreBackend());

const start = () => {
  const active = store.getActive();
  if (active) openServerWindow(active);
  else openOnboarding();
};

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { win.show(); win.focus(); }
  });
  app.whenReady().then(start);
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}

export { store };
```

> `openOnboarding` is implemented in Task 7's `servers-window.ts`. Until then, comment its call to keep dev runnable, or implement Task 7 first if executing out of order.

- [ ] **Step 3: Verify dev still launches**

Run: `npm run dev`
Expected: with no servers configured yet it will try onboarding (implemented next task). If running this task standalone, temporarily seed a server via devtools or proceed to Task 7. Build must compile: `npm run typecheck`.

- [ ] **Step 4: Commit**

```bash
git add src/main/windows/main-window.ts src/main/index.ts
git commit -m "feat: main window loads active server with guards + hide-to-tray"
```

---

## Phase 3 — Local pages, preload bridges & IPC

### Task 7: shell preload + IPC + onboarding/servers windows

**Files:**
- Create: `src/shared/ipc.ts`
- Create: `src/preload/shell.ts`
- Create: `src/main/ipc.ts`
- Create: `src/main/windows/servers-window.ts`, `src/main/windows/local-renderer.ts`
- Create: `src/renderer/router.tsx`, `src/renderer/pages/Onboarding.tsx`, `src/renderer/pages/Servers.tsx`
- Modify: `src/renderer/main.tsx`

- [ ] **Step 1: Define IPC channels in `src/shared/ipc.ts`**

```ts
export const IPC = {
  serversList: 'servers:list',
  serversAdd: 'servers:add',
  serversUpdate: 'servers:update',
  serversRemove: 'servers:remove',
  serversSwitch: 'servers:switch',
  serversValidate: 'servers:validate',
  prefsGet: 'prefs:get',
  prefsSet: 'prefs:set',
  serversChanged: 'servers:changed'
} as const;
```

- [ ] **Step 2: Implement `src/preload/shell.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type { Prefs, ServerEntry } from '../shared/types';

contextBridge.exposeInMainWorld('shell', {
  servers: {
    list: (): Promise<ServerEntry[]> => ipcRenderer.invoke(IPC.serversList),
    add: (url: string, label: string): Promise<{ ok: boolean; reason?: string }> =>
      ipcRenderer.invoke(IPC.serversAdd, { url, label }),
    update: (id: string, patch: Partial<ServerEntry>) => ipcRenderer.invoke(IPC.serversUpdate, { id, patch }),
    remove: (id: string) => ipcRenderer.invoke(IPC.serversRemove, { id }),
    switchTo: (id: string) => ipcRenderer.invoke(IPC.serversSwitch, { id }),
    validateUrl: (url: string) => ipcRenderer.invoke(IPC.serversValidate, { url })
  },
  prefs: {
    get: (): Promise<Prefs> => ipcRenderer.invoke(IPC.prefsGet),
    set: (patch: Partial<Prefs>) => ipcRenderer.invoke(IPC.prefsSet, patch)
  },
  onServersChanged: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on(IPC.serversChanged, handler);
    return () => ipcRenderer.removeListener(IPC.serversChanged, handler);
  }
});
```

- [ ] **Step 3: Implement `src/main/ipc.ts`** (validates input, drives store + windows)

```ts
import { BrowserWindow, ipcMain } from 'electron';
import { IPC } from '../shared/ipc';
import { normalizeServerUrl } from './servers/url';
import { probeServer } from './servers/validate';
import type { createServerStore } from './servers/store';
import { openServerWindow } from './windows/main-window';

type Store = ReturnType<typeof createServerStore>;

const broadcastServersChanged = () => {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(IPC.serversChanged));
};

export const registerIpc = (store: Store) => {
  ipcMain.handle(IPC.serversList, () => store.list());
  ipcMain.handle(IPC.prefsGet, () => store.getPrefs());
  ipcMain.handle(IPC.prefsSet, (_e, patch) => store.setPrefs(patch));

  ipcMain.handle(IPC.serversValidate, async (_e, { url }: { url: string }) => {
    const norm = normalizeServerUrl(url);
    if (!norm.ok) return { ok: false, reason: norm.reason };
    const probe = await probeServer(norm.url);
    return probe.reachable ? { ok: true, url: norm.url } : { ok: false, reason: probe.reason ?? 'unreachable' };
  });

  ipcMain.handle(IPC.serversAdd, async (_e, { url, label }: { url: string; label: string }) => {
    const norm = normalizeServerUrl(url);
    if (!norm.ok) return { ok: false, reason: norm.reason };
    const entry = store.add(norm.url, label || norm.url);
    broadcastServersChanged();
    return { ok: true, id: entry.id };
  });

  ipcMain.handle(IPC.serversUpdate, (_e, { id, patch }) => {
    if (!store.list().some((s) => s.id === id)) return { ok: false, reason: 'not-found' };
    store.update(id, patch);
    broadcastServersChanged();
    return { ok: true };
  });

  ipcMain.handle(IPC.serversRemove, (_e, { id }: { id: string }) => {
    store.remove(id);
    broadcastServersChanged();
    return { ok: true };
  });

  ipcMain.handle(IPC.serversSwitch, (_e, { id }: { id: string }) => {
    const server = store.list().find((s) => s.id === id);
    if (!server) return { ok: false, reason: 'not-found' };
    store.switchTo(id);
    openServerWindow(server);
    return { ok: true };
  });
};
```

- [ ] **Step 4: Implement local window helpers**

`src/main/windows/local-renderer.ts`:
```ts
import { BrowserWindow } from 'electron';
import { join } from 'node:path';

export const createLocalWindow = (route: string, opts?: { width?: number; height?: number }) => {
  const win = new BrowserWindow({
    width: opts?.width ?? 520,
    height: opts?.height ?? 600,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: join(import.meta.dirname, '../preload/shell.js')
    }
  });
  const base = process.env.ELECTRON_RENDERER_URL;
  if (base) void win.loadURL(`${base}#${route}`);
  else void win.loadFile('out/renderer/index.html', { hash: route });
  return win;
};
```
`src/main/windows/servers-window.ts`:
```ts
import { createLocalWindow } from './local-renderer';

export const openOnboarding = () => createLocalWindow('/onboarding', { width: 520, height: 420 });
export const openServersManager = () => createLocalWindow('/servers', { width: 560, height: 640 });
```

- [ ] **Step 5: Implement renderer pages + router**

`src/renderer/router.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Onboarding } from './pages/Onboarding';
import { Servers } from './pages/Servers';

export const Router = () => {
  const [hash, setHash] = useState(window.location.hash.replace('#', '') || '/onboarding');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash.replace('#', ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (hash.startsWith('/servers')) return <Servers />;
  return <Onboarding />;
};
```
`src/renderer/pages/Onboarding.tsx`:
```tsx
import { useState } from 'react';

declare global { interface Window { shell: any } }

export const Onboarding = () => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const onSubmit = async () => {
    setStatus('Checking…');
    const res = await window.shell.servers.add(url, '');
    if (res.ok) {
      await window.shell.servers.switchTo(res.id);
      window.close();
    } else {
      setStatus(`Could not add server: ${res.reason}`);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2>Connect to your Bullshark server</h2>
      <p>Enter the URL of your Bullshark instance.</p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://chat.example.com" style={{ width: '100%', padding: 8 }} />
      <button onClick={onSubmit} style={{ marginTop: 12 }}>Connect</button>
      {status && <p>{status}</p>}
    </div>
  );
};
```
`src/renderer/pages/Servers.tsx`:
```tsx
import { useEffect, useState } from 'react';
import type { ServerEntry } from '../../shared/types';

export const Servers = () => {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [url, setUrl] = useState('');

  const refresh = async () => setServers(await window.shell.servers.list());
  useEffect(() => { void refresh(); return window.shell.onServersChanged(refresh); }, []);

  const add = async () => { const r = await window.shell.servers.add(url, ''); if (r.ok) { setUrl(''); } };

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
      <button onClick={add}>Add</button>
    </div>
  );
};
```
`src/renderer/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import { Router } from './router';
createRoot(document.getElementById('root')!).render(<Router />);
```

- [ ] **Step 6: Register IPC at startup in `src/main/index.ts`**

Add after the store is created:
```ts
import { registerIpc } from './ipc';
// ...
app.whenReady().then(() => { registerIpc(store); start(); });
```
(Replace the existing `app.whenReady().then(start)`.)

- [ ] **Step 7: Verify the full first-run loop**

Run: `npm run dev`
Expected: onboarding window opens (no servers). Enter a reachable URL → it validates, saves, and the main window loads that instance. Re-launch → goes straight to the instance.

- [ ] **Step 8: Commit**

```bash
git add src/shared/ipc.ts src/preload/shell.ts src/main/ipc.ts src/main/windows src/renderer
git commit -m "feat: shell preload, IPC, onboarding + servers windows"
```

### Task 8: Remote bridge preload (mute state + voice hook + focus)

> Design correction (decided during execution): the original plan suppressed notifications by
> overriding `window.Notification` in the preload. That does NOT work under `contextIsolation:
> true` — the preload's globals are isolated from the page's, so the override has no effect on the
> Bullshark page. DND suppression is therefore enforced by the **web app companion change**
> (checks `window.bullshark.notifications.isMuted()` before emitting). The bridge only holds and
> exposes the mute state + the voice hooks + a `focusWindow()` method. No `window.Notification`
> override; consequently the preload uses no DOM globals and needs no tsconfig change.

**Files:**
- Create: `src/preload/bridge.ts`
- Modify: `src/shared/ipc.ts`, `src/shared/types.ts`

- [ ] **Step 1: Add bridge IPC channels + types**

In `src/shared/ipc.ts` add:
```ts
export const BRIDGE = {
  setMuted: 'bridge:set-muted',              // main → remote (DND state)
  voiceToggleRequest: 'bridge:voice-toggle', // main → remote (toggle mic)
  voiceState: 'bridge:voice-state',          // remote → main ({ inVoice, muted })
  focusWindow: 'bridge:focus-window'         // remote → main (show/focus the window)
} as const;
```
In `src/shared/types.ts` add:
```ts
export type VoiceState = { inVoice: boolean; muted: boolean };
```

- [ ] **Step 2: Implement `src/preload/bridge.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { BRIDGE } from '../shared/ipc';
import type { VoiceState } from '../shared/types';

let muted = false;
ipcRenderer.on(BRIDGE.setMuted, (_e, value: boolean) => { muted = value; });

// NOTE: we deliberately do NOT override window.Notification here. Under
// contextIsolation the preload's globals are isolated from the page, so an
// override would have no effect. DND is enforced by the web app companion
// change consulting notifications.isMuted() before calling new Notification().
contextBridge.exposeInMainWorld('bullshark', {
  isDesktop: true,
  notifications: { isMuted: () => muted },
  voice: {
    reportState: (state: VoiceState) => ipcRenderer.send(BRIDGE.voiceState, state),
    onToggleRequest: (cb: () => void) => {
      const h = () => cb();
      ipcRenderer.on(BRIDGE.voiceToggleRequest, h);
      return () => ipcRenderer.removeListener(BRIDGE.voiceToggleRequest, h);
    }
  },
  focusWindow: () => ipcRenderer.send(BRIDGE.focusWindow),
  onMuteChanged: (cb: (muted: boolean) => void) => {
    const h = (_e: unknown, v: boolean) => cb(v);
    ipcRenderer.on(BRIDGE.setMuted, h);
    return () => ipcRenderer.removeListener(BRIDGE.setMuted, h);
  }
});
```

> The entire `window.bullshark` surface is inert until the companion change lands in the
> `bullshark` web repo (separate small plan): the web app feature-detects `window.bullshark`,
> checks `notifications.isMuted()` before notifying, drives `voice`, and calls `focusWindow()`
> on notification click. The desktop side ships the surface now so it lights up when that lands.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/preload/bridge.ts src/shared/ipc.ts src/shared/types.ts
git commit -m "feat: remote bridge preload — DND notification gate + voice hook"
```

---

## Phase 4 — Tray, mute state, notifications

### Task 9: Tray with menu, DND toggle, hide-to-tray quit path

**Files:**
- Create: `src/main/notifications.ts`, `src/main/tray.ts`
- Modify: `src/main/index.ts`
- Assets: `build/tray/` (normal, notif-muted, mic-muted icons per platform)

- [ ] **Step 1: Implement `notifications.ts` (DND state holder, broadcasts to remote)**

```ts
import { BrowserWindow } from 'electron';
import { BRIDGE } from '../shared/ipc';

let muted = false;
export const isNotificationsMuted = () => muted;
export const setNotificationsMuted = (value: boolean) => {
  muted = value;
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(BRIDGE.setMuted, value));
};
```

- [ ] **Step 2: Implement `tray.ts`**

```ts
import { app, Menu, Tray, nativeImage } from 'electron';
import { join } from 'node:path';
import { isNotificationsMuted, setNotificationsMuted } from './notifications';
import { getVoiceState, requestVoiceToggle } from './voice-bridge';
import { showMainWindow } from './windows/main-window';
import { openServersManager } from './windows/servers-window';
import type { createServerStore } from './servers/store';

type Store = ReturnType<typeof createServerStore>;
let tray: Tray | null = null;

const iconFor = (state: 'normal' | 'notif-muted' | 'mic-muted') =>
  nativeImage.createFromPath(join(import.meta.dirname, `../../build/tray/${state}.png`));

export const refreshTray = (store: Store) => {
  if (!tray) return;
  const voice = getVoiceState();
  const state = voice.inVoice && voice.muted ? 'mic-muted' : isNotificationsMuted() ? 'notif-muted' : 'normal';
  tray.setImage(iconFor(state));

  const active = store.getActive();
  const menu = Menu.buildFromTemplate([
    { label: active ? `Bullshark — ${active.label || active.url}` : 'Bullshark', enabled: false },
    { type: 'separator' },
    { label: 'Notifications', type: 'checkbox', checked: !isNotificationsMuted(),
      click: () => { setNotificationsMuted(!isNotificationsMuted()); refreshTray(store); } },
    { label: 'Microphone', type: 'checkbox', checked: voice.inVoice && !voice.muted, enabled: voice.inVoice,
      click: () => requestVoiceToggle() },
    { type: 'separator' },
    { label: 'Servers', submenu: [
      ...store.list().map((s) => ({
        label: s.label || s.url, type: 'radio' as const, checked: s.id === active?.id,
        click: () => { store.switchTo(s.id); }
      })),
      { type: 'separator' as const },
      { label: 'Manage servers…', click: () => openServersManager() }
    ] },
    { type: 'separator' },
    { label: 'Show Bullshark', click: () => showMainWindow() },
    { label: 'Quit', click: () => { (global as { isQuitting?: boolean }).isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
};

export const initTray = (store: Store) => {
  tray = new Tray(iconFor('normal'));
  tray.setToolTip('Bullshark');
  tray.on('click', () => showMainWindow());
  refreshTray(store);
};
```

- [ ] **Step 3: Add placeholder tray assets**

Create `build/tray/normal.png`, `notif-muted.png`, `mic-muted.png` (16/32px template-style icons; a colored circle distinguishing each state is acceptable for v1). Commit the binaries.

- [ ] **Step 4: Init tray at startup in `src/main/index.ts`**

```ts
import { initTray } from './tray';
// inside whenReady, after registerIpc(store) and start():
initTray(store);
```

- [ ] **Step 5: Verify**

Run: `npm run dev`
Expected: tray icon appears; toggling "Notifications" flips the checkbox; closing the window hides to tray; "Show Bullshark" restores; "Quit" exits. The "Microphone" item is disabled (no voice state yet).

- [ ] **Step 6: Commit**

```bash
git add src/main/notifications.ts src/main/tray.ts src/main/index.ts build/tray
git commit -m "feat: system tray with DND toggle, server switch, hide-to-tray"
```

### Task 10: Voice mute bridge wiring (tray ↔ remote)

**Files:**
- Create: `src/main/voice-bridge.ts`
- Modify: `src/main/ipc.ts`, `src/main/tray.ts` (already imports the helpers)

- [ ] **Step 1: Implement `voice-bridge.ts`**

```ts
import { BrowserWindow } from 'electron';
import { BRIDGE } from '../shared/ipc';
import type { VoiceState } from '../shared/types';

let state: VoiceState = { inVoice: false, muted: false };
export const getVoiceState = () => state;

export const setVoiceState = (next: VoiceState) => { state = next; };

export const requestVoiceToggle = () => {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(BRIDGE.voiceToggleRequest));
};
```

- [ ] **Step 2: Receive voice state from the remote page in `ipc.ts`**

Add inside `registerIpc`, and accept a tray-refresh callback:
```ts
import { BRIDGE } from '../shared/ipc';
import { setVoiceState } from './voice-bridge';
// ...
export const registerIpc = (store: Store, onVoiceState?: () => void) => {
  // ...existing handlers...
  ipcMain.on(BRIDGE.voiceState, (_e, next) => { setVoiceState(next); onVoiceState?.(); });
};
```
Update the `index.ts` call to: `registerIpc(store, () => refreshTray(store));` (import `refreshTray`).

- [ ] **Step 3: Typecheck + manual contract check**

Run: `npm run typecheck`
Expected: clean. Full mic-mute round-trip requires the `bullshark` web companion change (separate plan); until then, simulate by sending `BRIDGE.voiceState` from devtools to confirm the tray enables/updates the Microphone item.

- [ ] **Step 4: Commit**

```bash
git add src/main/voice-bridge.ts src/main/ipc.ts src/main/index.ts
git commit -m "feat: voice mute bridge — tray toggle + remote state sync"
```

### Task 11: Notification click → focus window (main-side handler)

The bridge already exposes `window.bullshark.focusWindow()` (added in Task 8) and the
`BRIDGE.focusWindow` channel. This task wires the main-process side. (The web app calls
`focusWindow()` in its notification `onclick` — that is part of the companion change.)

**Files:**
- Modify: `src/main/ipc.ts`

- [ ] **Step 1: Handle the focus request in main**

In `src/main/ipc.ts`, import `showMainWindow` from `./windows/main-window` and `BRIDGE` from
`../shared/ipc`, then inside `registerIpc` add:
```ts
ipcMain.on(BRIDGE.focusWindow, () => showMainWindow());
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc.ts
git commit -m "feat: focus the window on notification click (bridge focusWindow handler)"
```

---

## Phase 5 — Auto-update

### Task 12: Updater abstraction with macOS fallback

**Files:**
- Create: `src/main/updater/index.ts`, `src/main/updater/electron-updater-impl.ts`, `src/main/updater/github-fallback.ts`
- Test: `src/main/updater/select.test.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Write the failing test for platform selection**

```ts
import { describe, expect, test } from 'vitest';
import { selectUpdaterKind } from './index';

describe('selectUpdaterKind', () => {
  test('windows uses native electron-updater', () => {
    expect(selectUpdaterKind('win32', false)).toBe('native');
  });
  test('linux uses native electron-updater', () => {
    expect(selectUpdaterKind('linux', false)).toBe('native');
  });
  test('unsigned macOS uses github fallback', () => {
    expect(selectUpdaterKind('darwin', false)).toBe('github-fallback');
  });
  test('signed macOS uses native', () => {
    expect(selectUpdaterKind('darwin', true)).toBe('native');
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- src/main/updater/select.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `updater/index.ts`**

```ts
import { initNativeUpdater } from './electron-updater-impl';
import { initGithubFallback } from './github-fallback';

export type UpdaterKind = 'native' | 'github-fallback';

// macOS Squirrel requires a signed+notarized build; unsigned mac falls back to
// notify + open-release. Win/Linux auto-update unsigned via electron-updater.
export const selectUpdaterKind = (platform: NodeJS.Platform, macSigned: boolean): UpdaterKind => {
  if (platform === 'darwin' && !macSigned) return 'github-fallback';
  return 'native';
};

export const initUpdater = (opts: { repo: string; macSigned?: boolean }) => {
  const kind = selectUpdaterKind(process.platform, opts.macSigned ?? false);
  if (kind === 'native') initNativeUpdater();
  else initGithubFallback(opts.repo);
};
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/main/updater/select.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement the two strategies**

`updater/electron-updater-impl.ts`:
```ts
import { Notification } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

export const initNativeUpdater = () => {
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', () => {
    const n = new Notification({ title: 'Bullshark', body: 'Update ready — restart to apply.' });
    n.on('click', () => autoUpdater.quitAndInstall());
    n.show();
  });
  void autoUpdater.checkForUpdates();
  setInterval(() => void autoUpdater.checkForUpdates(), 6 * 60 * 60 * 1000);
};
```
`updater/github-fallback.ts`:
```ts
import { Notification, shell, app } from 'electron';

// macOS unsigned: poll GitHub Releases; on a newer version, notify + open the page.
export const initGithubFallback = (repo: string) => {
  const check = async () => {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!res.ok) return;
      const latest = (await res.json()) as { tag_name: string; html_url: string };
      const latestVersion = latest.tag_name.replace(/^v/, '');
      if (latestVersion && latestVersion !== app.getVersion()) {
        const n = new Notification({ title: 'Bullshark update available', body: `Version ${latestVersion} is available. Click to download.` });
        n.on('click', () => void shell.openExternal(latest.html_url));
        n.show();
      }
    } catch { /* offline — ignore */ }
  };
  void check();
  setInterval(check, 6 * 60 * 60 * 1000);
};
```

- [ ] **Step 6: Init updater at startup in `src/main/index.ts`**

```ts
import { initUpdater } from './updater';
// inside whenReady, after start():
initUpdater({ repo: 'Neckript/bullshark-desktop' });
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/main/updater src/main/index.ts
git commit -m "feat: auto-updater with native (win/linux) + macOS github fallback"
```

---

## Phase 6 — Build & release

### Task 13: electron-builder config + GitHub Actions

**Files:**
- Create: `electron-builder.yml`, `.github/workflows/release.yml`, `.github/workflows/ci.yml`
- Create: `build/icon.ico`, `build/icon.icns`, `build/icon.png`

- [ ] **Step 1: Create `electron-builder.yml`**

```yaml
appId: fr.bullshark.desktop
productName: Bullshark
directories:
  output: dist
  buildResources: build
files:
  - out/**
publish:
  provider: github
  owner: Neckript
  repo: bullshark-desktop
win:
  target: [{ target: nsis, arch: [x64] }]
mac:
  target: [{ target: dmg, arch: [universal] }, { target: zip, arch: [universal] }]
  category: public.app-category.social-networking
linux:
  target: [{ target: AppImage, arch: [x64] }, { target: deb, arch: [x64] }]
  category: Network
```

- [ ] **Step 2: Add app icons**

Provide `build/icon.ico` (Windows), `build/icon.icns` (macOS), `build/icon.png` 512×512 (Linux). Reuse the Bullshark logo.

- [ ] **Step 3: Create `.github/workflows/ci.yml`** (PRs: typecheck + test)

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 4: Create `.github/workflows/release.yml`** (tag → build matrix → publish)

```yaml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  release:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: npx electron-builder --publish always
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 5: Verify a local unpublished build**

Run: `npm run dist`
Expected: `dist/` contains an installer for the current OS. (Cross-OS artifacts are produced by CI.)

- [ ] **Step 6: Commit**

```bash
git add electron-builder.yml .github build/icon.*
git commit -m "chore: electron-builder targets + CI/release workflows"
```

---

## Phase 7 — Docs & verification

### Task 14: README + end-to-end verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`** covering: what it is, first-run (enter server URL), tray features (mute notifications / mic), multi-server switching, **macOS unsigned note** (right-click → Open on first launch; updates via release page until signed), build/release instructions, and the required `bullshark` web companion change for mic mute (link to its future plan).

- [ ] **Step 2: Full verification pass**

- [ ] `npm test` → all PASS.
- [ ] `npm run typecheck` → clean.
- [ ] `npm run lint` → clean.
- [ ] `npm run dev`: first run → onboarding → enter a real Bullshark URL → loads; relaunch → straight to instance; add a 2nd server → switch (sessions independent: logging into one does not log into the other); toggle DND (with a known notification trigger, confirm suppression); close → hides to tray; Quit exits.
- [ ] `npm run dist` → installer builds for the current OS.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README + verification checklist"
```

---

## Notes & constraints

- **No hardcoded server URL** — onboarding is the only source; stored in `userData`.
- **Per-server partitions** (`persist:server-<id>`) keep sessions/logins isolated.
- **Security**: contextIsolation + sandbox + no nodeIntegration on every window; navigation guards on remote content; contextBridge-only IPC.
- **Mic mute** needs a small, feature-detected companion change in the `bullshark` web repo (separate plan); everything else works without touching `bullshark`.
- **macOS unsigned**: auto-update uses the GitHub-release-page fallback; flipping `macSigned`/adding notarization later switches to native auto-update with no other code change.
- Branch: `main` (new repo).

## Self-review

- **Spec coverage:** WebView wrapper of configured instance (Tasks 6) ✓; first-launch URL config, no hardcode (Tasks 3,4,7) ✓; multi-server + switcher + isolated sessions (Tasks 3,5,7,9) ✓; tray mute notifications (Tasks 8,9) ✓; tray mute mic (Tasks 8,10) ✓; native notifications + click (Tasks 8,11) ✓; auto-update via GitHub + unsigned mac fallback (Task 12) ✓; builds win/mac-universal/linux (Task 13) ✓; modern Electron structure/security (Tasks 1,5) ✓.
- **Placeholder scan:** route bodies and configs are complete code; tray/app icons are binary assets created in their steps (not code placeholders); the mic-mute end-to-end test is explicitly gated on the documented companion change, not a TODO.
- **Type consistency:** `ServerEntry`/`Prefs`/`VoiceState` (shared/types), `IPC`/`BRIDGE` channel constants, `createServerStore` API (`list/add/update/switchTo/remove/getActive/getPrefs/setPrefs`), `openServerWindow`/`showMainWindow`, `getVoiceState`/`requestVoiceToggle`/`setVoiceState`, `selectUpdaterKind`/`initUpdater` are used consistently across tasks.
