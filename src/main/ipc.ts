import { BrowserWindow, ipcMain } from 'electron';
import { BRIDGE, IPC } from '../shared/ipc';
import { normalizeServerUrl } from './servers/url';
import { probeServer } from './servers/validate';
import type { createServerStore } from './servers/store';
import { openServerWindow, showMainWindow } from './windows/main-window';
import type { Prefs, VoiceState } from '../shared/types';
import { setVoiceState } from './voice-bridge';

type Store = ReturnType<typeof createServerStore>;

const broadcastServersChanged = () => {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(IPC.serversChanged));
};

export const registerIpc = (store: Store, onVoiceState?: () => void) => {
  ipcMain.handle(IPC.serversList, () => store.list());
  ipcMain.handle(IPC.prefsGet, () => store.getPrefs());
  ipcMain.handle(IPC.prefsSet, (_e, patch: unknown) => {
    if (typeof patch !== 'object' || patch === null) return store.getPrefs();
    const p = patch as Record<string, unknown>;
    const allowed: (keyof Prefs)[] = ['activeServerId', 'notificationsMuted', 'launchOnStartup', 'lastWindowBounds'];
    const sanitized: Partial<Prefs> = {};
    for (const key of allowed) if (key in p) (sanitized as Record<string, unknown>)[key] = p[key];
    store.setPrefs(sanitized);
    return store.getPrefs();
  });

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

  ipcMain.on(BRIDGE.voiceState, (_e, next: VoiceState) => {
    setVoiceState(next);
    onVoiceState?.();
  });

  ipcMain.on(BRIDGE.focusWindow, () => showMainWindow());
};
