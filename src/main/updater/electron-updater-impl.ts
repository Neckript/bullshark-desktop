import { Notification } from 'electron';
import { autoUpdater } from 'electron-updater';
import { getForgejoFeedUrl } from './forgejo-feed';

const checkFromCodeberg = async () => {
  try {
    const url = await getForgejoFeedUrl();
    autoUpdater.setFeedURL({ provider: 'generic', url });
  } catch {
    // Codeberg unreachable — skip this check, retry at the next interval.
    return;
  }
  void autoUpdater.checkForUpdates();
};

export const initNativeUpdater = async () => {
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', () => {
    const n = new Notification({ title: 'Bullshark', body: 'Update ready — restart to apply.' });
    n.on('click', () => autoUpdater.quitAndInstall());
    n.show();
  });
  await checkFromCodeberg();
  setInterval(() => void checkFromCodeberg(), 6 * 60 * 60 * 1000);
};
