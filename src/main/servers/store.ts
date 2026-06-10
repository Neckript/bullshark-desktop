import { randomUUID } from 'node:crypto';
import Store from 'electron-store';
import { DEFAULT_PREFS, type Prefs, type ServerEntry } from '../../shared/types';

export type StoreBackend = {
  get<T>(key: string, defaultValue: T): T;
  set(key: string, value: unknown): void;
};

export const createServerStore = (backend: StoreBackend) => {
  const listServers = (): ServerEntry[] => backend.get<ServerEntry[]>('servers', []);
  const getPrefs = (): Prefs => backend.get<Prefs>('prefs', { ...DEFAULT_PREFS });
  const setPrefs = (patch: Partial<Prefs>) => backend.set('prefs', { ...getPrefs(), ...patch });

  const add = (url: string, label: string): ServerEntry => {
    const entry: ServerEntry = { id: randomUUID(), label, url, lastUsedAt: Date.now() };
    const servers = [...listServers(), entry];
    backend.set('servers', servers);
    if (getPrefs().activeServerId === null) setPrefs({ activeServerId: entry.id });
    return entry;
  };

  const update = (id: string, patch: Partial<Pick<ServerEntry, 'label' | 'url'>>) => {
    backend.set('servers', listServers().map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const switchTo = (id: string) => {
    backend.set('servers', listServers().map((s) => (s.id === id ? { ...s, lastUsedAt: Date.now() } : s)));
    setPrefs({ activeServerId: id });
  };

  const remove = (id: string) => {
    const remaining = listServers().filter((s) => s.id !== id);
    backend.set('servers', remaining);
    if (getPrefs().activeServerId === id) {
      const fallback = [...remaining].sort((a, b) => b.lastUsedAt - a.lastUsedAt)[0];
      setPrefs({ activeServerId: fallback ? fallback.id : null });
    }
  };

  const getActive = (): ServerEntry | null => {
    const id = getPrefs().activeServerId;
    return listServers().find((s) => s.id === id) ?? null;
  };

  return { list: listServers, add, update, switchTo, remove, getActive, getPrefs, setPrefs };
};

export const electronStoreBackend = (): StoreBackend => {
  const store = new Store();
  return {
    get: (key, defaultValue) => store.get(key, defaultValue) as never,
    set: (key, value) => store.set(key, value)
  };
};
