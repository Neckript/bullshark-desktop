export const session = { fromPartition: () => ({}) };
export const shell: { openExternal: (url: string) => Promise<void> } = { openExternal: () => Promise.resolve() };
export const globalShortcut = { register: () => true, unregisterAll: () => {} };
export const BrowserWindow = { getAllWindows: () => [] as { webContents: { send: (channel: string) => void } }[] };

export const app = { getVersion: () => '0.0.0-test', getLocale: () => 'en-US' };

type IpcHandler = (...args: unknown[]) => unknown;

// `handlers`/`listeners` are memorized so tests can retrieve what `ipcMain.handle`
// / `ipcMain.on` registered on a given channel — this is the mock's own
// introspection surface, not part of the real Electron API.
export const ipcMain = {
  handlers: new Map<string, IpcHandler>(),
  listeners: new Map<string, IpcHandler>(),
  handle(channel: string, handler: IpcHandler) {
    this.handlers.set(channel, handler);
  },
  on(channel: string, handler: IpcHandler) {
    this.listeners.set(channel, handler);
  }
};

export const desktopCapturer = { getSources: () => Promise.resolve([]) };
