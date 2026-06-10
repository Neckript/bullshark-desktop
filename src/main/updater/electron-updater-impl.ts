import { Notification } from 'electron';
import { autoUpdater } from 'electron-updater';

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
