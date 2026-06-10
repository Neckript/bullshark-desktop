import { Notification, shell, app } from 'electron';

// macOS unsigned: poll GitHub Releases; on a newer version, notify + open the page.
export const initGithubFallback = (repo: string) => {
  const check = async () => {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' }
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
