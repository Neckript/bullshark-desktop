import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import type { ServerEntry } from '../../shared/types';
import { applyNavigationGuards } from '../navigation';
import { partitionForServer } from '../servers/session';
import { fetchServerInfo } from '../servers/server-info';
import { evaluateCompat } from '../servers/compat';
import { resolveLocale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';
import { BRIDGE } from '../../shared/bridge';

let mainWindow: BrowserWindow | null = null;

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
  mainWindow.webContents.once('did-finish-load', () => {
    void sendCompatBanner(mainWindow!, server.url);
  });
  void mainWindow.loadURL(server.url);
};
