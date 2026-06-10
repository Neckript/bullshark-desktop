import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type { Prefs, ServerEntry } from '../shared/types';

contextBridge.exposeInMainWorld('shell', {
  servers: {
    list: (): Promise<ServerEntry[]> => ipcRenderer.invoke(IPC.serversList),
    add: (url: string, label: string): Promise<{ ok: boolean; reason?: string; id?: string }> =>
      ipcRenderer.invoke(IPC.serversAdd, { url, label }),
    update: (id: string, patch: Partial<ServerEntry>) => ipcRenderer.invoke(IPC.serversUpdate, { id, patch }),
    remove: (id: string) => ipcRenderer.invoke(IPC.serversRemove, { id }),
    switchTo: (id: string) => ipcRenderer.invoke(IPC.serversSwitch, { id }),
    validateUrl: (url: string) => ipcRenderer.invoke(IPC.serversValidate, { url })
  },
  prefs: {
    get: (): Promise<Prefs> => ipcRenderer.invoke(IPC.prefsGet),
    set: (patch: Partial<Prefs>) => ipcRenderer.invoke(IPC.prefsSet, patch)
  },
  onServersChanged: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on(IPC.serversChanged, handler);
    return () => ipcRenderer.removeListener(IPC.serversChanged, handler);
  }
});
