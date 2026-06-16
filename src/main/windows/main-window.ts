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

let mainWindow: BrowserWindow | null = null;

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

export const getMainWindow = () => mainWindow;

export const showMainWindow = () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
};

// Reads the server version and, if it warrants a banner, sends a localized
// message to the bridge preload. Never throws into the load path.
const sendCompatBanner = async (win: BrowserWindow, serverUrl: string) => {
  try {
    const info = await fetchServerInfo(serverUrl);
    const verdict = evaluateCompat(info?.version ?? null);
    if (verdict !== 'too-old' && verdict !== 'native-unavailable') return;
    const code = verdict === 'too-old' ? 'server-too-old' : 'server-native-unavailable';
    const message = t(code, resolveLocale(app.getLocale()));
    if (!win.isDestroyed()) win.webContents.send(BRIDGE.compat, { verdict, message });
  } catch {
    // a compatibility check must never break loading the server
  }
};

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
        preload: join(import.meta.dirname, '../preload/bridge.cjs')
      }
    });
    mainWindow.once('ready-to-show', () => mainWindow?.show());
    loadedVersion = null;
    notifiedVersion = null;
    lastUpdateCheckAt = 0;
    // Close hides to tray (the real quit path is wired with the tray task).
    mainWindow.on('close', (event) => {
      if (!(global as { isQuitting?: boolean }).isQuitting) {
        event.preventDefault();
        mainWindow?.hide();
      }
    });
  } else {
    // Switching servers requires a fresh partition -> recreate the window.
    mainWindow.destroy();
    mainWindow = null;
    openServerWindow(server);
    return;
  }
  applyNavigationGuards(mainWindow.webContents, new URL(server.url).origin);
  installScreenShareHandler(mainWindow.webContents.session, getMainWindow);
  // .on (not .once): re-capture the baseline after every load, including reloads
  // triggered by the update banner — otherwise loadedVersion stays stale.
  mainWindow.webContents.on('did-finish-load', () => {
    void sendCompatBanner(mainWindow!, server.url);
    void captureLoadedVersion(server.url);
  });

  mainWindow.on('focus', () => {
    void checkForServerUpdate(server);
  });

  void mainWindow.loadURL(server.url);
};
