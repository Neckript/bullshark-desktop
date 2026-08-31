import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { IPC, REPOSITORY_TARGETS, type RepositoryTarget } from '../shared/ipc';
import { BRIDGE } from '../shared/bridge';
import { normalizeServerUrl } from './servers/url';
import { probeServer } from './servers/validate';
import type { createServerStore } from './servers/store';
import { openServerWindow, showMainWindow } from './windows/main-window';
import type { Prefs, VoiceState } from '../shared/types';
import { setVoiceState } from './voice-bridge';
import { resolveLocale } from '../shared/i18n/locales';
import { getSourceDtos, chooseSource, cancelShare } from './screen-share';
import { registerHotkeys } from './hotkeys';

type Store = ReturnType<typeof createServerStore>;

// Les deux faces du dépôt, dans l'ordre d'affichage. Codeberg est le dépôt
// souverain (remote `origin`), GitHub n'en est que le miroir (remote `github`,
// celui qui déclenche la CI) — c'est aussi l'URL que porte `repository.url` de
// package.json. Ne les réécris pas de tête : relis `git remote -v`.
const REPOSITORY_URLS: Record<RepositoryTarget, string> = {
  codeberg: 'https://codeberg.org/The_Neckript/bullshark-desktop',
  github: 'https://github.com/Neckript/bullshark-desktop'
};

const isRepositoryTarget = (value: unknown): value is RepositoryTarget =>
  REPOSITORY_TARGETS.includes(value as RepositoryTarget);

const broadcastServersChanged = () => {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(IPC.serversChanged));
};

export const registerIpc = (store: Store, onVoiceState?: () => void) => {
  ipcMain.handle(IPC.appLocale, () => resolveLocale(app.getLocale()));
  ipcMain.handle(IPC.appVersion, () => app.getVersion());
  // Le renderer choisit une CLE dans une liste fermee, jamais une URL : un
  // pont qui ouvrirait une URL arbitraire serait une surface d'attaque. Une
  // cle inconnue n'ouvre rien.
  ipcMain.handle(IPC.appRepository, (_e, target: unknown) => {
    if (!isRepositoryTarget(target)) return;
    void shell.openExternal(REPOSITORY_URLS[target]);
  });
  ipcMain.handle(IPC.serversList, () => store.list());
  ipcMain.handle(IPC.prefsGet, () => store.getPrefs());
  ipcMain.handle(IPC.prefsSet, (_e, patch: unknown) => {
    if (typeof patch !== 'object' || patch === null) return store.getPrefs();
    const p = patch as Record<string, unknown>;
    const allowed: (keyof Prefs)[] = ['activeServerId', 'notificationsMuted', 'launchOnStartup', 'lastWindowBounds', 'muteHotkey'];
    const sanitized: Partial<Prefs> = {};
    for (const key of allowed) if (key in p) (sanitized as Record<string, unknown>)[key] = p[key];
    store.setPrefs(sanitized);
    if ('muteHotkey' in sanitized) registerHotkeys(store);
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
    void openServerWindow(server);
    return { ok: true };
  });

  ipcMain.handle(IPC.screenSources, () => getSourceDtos());
  ipcMain.handle(IPC.screenPick, (_e, id: string) => chooseSource(id));
  ipcMain.handle(IPC.screenCancel, () => cancelShare());

  ipcMain.on(BRIDGE.voiceState, (_e, next: VoiceState) => {
    if (typeof next?.inVoice !== 'boolean' || typeof next?.muted !== 'boolean') return;
    setVoiceState(next);
    onVoiceState?.();
  });

  ipcMain.on(BRIDGE.focusWindow, () => showMainWindow());
};
