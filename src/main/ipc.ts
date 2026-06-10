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

  ipcMain.handle(IPC.serversUpdate, (_e, { id, patch }: { id: string; patch: Partial<{ label: string; url: string }> }) => {
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
