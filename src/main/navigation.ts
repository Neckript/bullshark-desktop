import { shell, type WebContents } from 'electron';

// Keep the user inside their configured origin; send everything else to the OS browser.
export const applyNavigationGuards = (contents: WebContents, allowedOrigin: string) => {
  contents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).origin !== allowedOrigin) {
        event.preventDefault();
        void shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });
};
