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
  void mainWindow.loadURL(server.url);
};
