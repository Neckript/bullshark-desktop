import { BrowserWindow } from 'electron';
import { join } from 'node:path';

let picker: BrowserWindow | null = null;

// Opens (or focuses) the screen-share source picker, parented to the server
// window. `onClosed` fires when the picker closes for any reason — the caller
// uses it to treat a manual close as a cancel (idempotent if already resolved).
export const openSharePicker = (parent: BrowserWindow, onClosed: () => void): BrowserWindow => {
  if (picker && !picker.isDestroyed()) {
    picker.focus();
    return picker;
  }
  picker = new BrowserWindow({
    width: 720,
    height: 520,
    parent,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Share your screen',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: join(import.meta.dirname, '../preload/shell.cjs')
    }
  });
  picker.on('closed', () => {
    picker = null;
    onClosed();
  });
  const base = process.env.ELECTRON_RENDERER_URL;
  if (base) void picker.loadURL(`${base}#/share-picker`);
  else void picker.loadFile(join(import.meta.dirname, '../renderer/index.html'), { hash: '/share-picker' });
  return picker;
};

export const closeSharePicker = () => {
  if (picker && !picker.isDestroyed()) picker.close();
  picker = null;
};
