export const session = { fromPartition: () => ({}) };
export const shell = { openExternal: () => Promise.resolve() };
export const globalShortcut = { register: () => true, unregisterAll: () => {} };
export const BrowserWindow = { getAllWindows: () => [] as { webContents: { send: (channel: string) => void } }[] };
