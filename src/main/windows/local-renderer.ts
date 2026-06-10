import { BrowserWindow } from 'electron';
import { join } from 'node:path';

export const createLocalWindow = (route: string, opts?: { width?: number; height?: number }) => {
  const win = new BrowserWindow({
    width: opts?.width ?? 520,
    height: opts?.height ?? 600,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: join(import.meta.dirname, '../preload/shell.cjs')
    }
  });
  const base = process.env.ELECTRON_RENDERER_URL;
  if (base) void win.loadURL(`${base}#${route}`);
  else void win.loadFile('out/renderer/index.html', { hash: route });
  return win;
};
