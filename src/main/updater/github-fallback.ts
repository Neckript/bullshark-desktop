import { Notification, shell, app } from 'electron';

const RELEASES_LATEST_URL =
  'https://codeberg.org/api/v1/repos/The_Neckript/bullshark-desktop/releases/latest';

// macOS unsigned: poll Codeberg (Forgejo) releases; on a newer version,
// notify + open the release page.
export const initForgejoFallback = () => {
  const check = async () => {
    try {
      const res = await fetch(RELEASES_LATEST_URL, {
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) return;
      const latest = (await res.json()) as { tag_name: string; html_url: string };
      const latestVersion = latest.tag_name.replace(/^v/, '');
      if (latestVersion && latestVersion !== app.getVersion()) {
        const n = new Notification({ title: 'Bullshark update available', body: `Version ${latestVersion} is available. Click to download.` });
        n.on('click', () => void shell.openExternal(latest.html_url));
        n.show();
      }
    } catch { /* offline — ignore */ }
  };
  void check();
  setInterval(check, 6 * 60 * 60 * 1000);
};
