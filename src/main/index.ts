import { app, BrowserWindow } from 'electron';
import { registerIpc } from './ipc';
import { createServerStore, electronStoreBackend } from './servers/store';
import { initTray, refreshTray } from './tray';
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
  app.whenReady().then(() => {
    registerIpc(store, () => refreshTray(store));
    start();
    initTray(store);
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}

export { store };
