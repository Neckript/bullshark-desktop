import { app, BrowserWindow, Menu } from 'electron';
import { registerIpc } from './ipc';
import { setNotificationsMuted } from './notifications';
import { createServerStore, electronStoreBackend } from './servers/store';
import { initTray, refreshTray } from './tray';
import { initUpdater } from './updater';
import { registerHotkeys, unregisterHotkeys } from './hotkeys';
import { openServerWindow } from './windows/main-window';
import { openOnboarding } from './windows/servers-window';

const store = createServerStore(electronStoreBackend());

const start = () => {
  const active = store.getActive();
  if (active) void openServerWindow(active);
  else openOnboarding();
};

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.setAppUserModelId('fr.bullshark.desktop');
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { win.show(); win.focus(); }
  });
  app.whenReady().then(() => {
    // Le menu applicatif par defaut n'a jamais ete ecrit pour Bullshark et
    // coute une bande de 30 px : ses deux accelerateurs utiles sont recables
    // sur la fenetre serveur (main-window.ts).
    Menu.setApplicationMenu(null);
    setNotificationsMuted(store.getPrefs().notificationsMuted);
    registerIpc(store, () => refreshTray(store));
    start();
    initTray(store);
    registerHotkeys(store);
    void initUpdater();
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('will-quit', () => unregisterHotkeys());
}

export { store };
