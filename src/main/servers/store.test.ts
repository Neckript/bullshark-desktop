import { beforeEach, describe, expect, test } from 'vitest';
import { DEFAULT_MUTE_HOTKEY } from '../../shared/types';
import { createServerStore, type StoreBackend } from './store';

const memoryBackend = (): StoreBackend => {
  const data = new Map<string, unknown>();
  return {
    get: (k, d) => (data.has(k) ? (data.get(k) as never) : d),
    set: (k, v) => void data.set(k, v)
  };
};

describe('server store', () => {
  let store: ReturnType<typeof createServerStore>;
  beforeEach(() => { store = createServerStore(memoryBackend()); });

  test('add returns an entry and lists it', () => {
    const entry = store.add('https://a.com', 'A');
    expect(entry.url).toBe('https://a.com');
    expect(store.list()).toHaveLength(1);
  });
  test('first added server becomes active', () => {
    const entry = store.add('https://a.com', 'A');
    expect(store.getPrefs().activeServerId).toBe(entry.id);
  });
  test('switchTo updates active + lastUsedAt', () => {
    const a = store.add('https://a.com', 'A');
    const b = store.add('https://b.com', 'B');
    store.switchTo(a.id);
    expect(store.getPrefs().activeServerId).toBe(a.id);
    expect(store.list().find((s) => s.id === a.id)!.lastUsedAt).toBeGreaterThan(0);
    expect(b.id).not.toBe(a.id);
  });
  test('remove drops the server; active falls back to remaining', () => {
    const a = store.add('https://a.com', 'A');
    const b = store.add('https://b.com', 'B');
    store.switchTo(b.id);
    store.remove(b.id);
    expect(store.list().map((s) => s.id)).toEqual([a.id]);
    expect(store.getPrefs().activeServerId).toBe(a.id);
  });
  test('removing the last server clears active', () => {
    const a = store.add('https://a.com', 'A');
    store.remove(a.id);
    expect(store.getPrefs().activeServerId).toBeNull();
  });
  test('getPrefs merges defaults over stored partial prefs', () => {
    const backend = memoryBackend();
    // simulate prefs persisted by an older app version (no muteHotkey)
    backend.set('prefs', { activeServerId: null, notificationsMuted: true });
    const s = createServerStore(backend);
    expect(s.getPrefs().muteHotkey).toBe(DEFAULT_MUTE_HOTKEY);
    expect(s.getPrefs().notificationsMuted).toBe(true);
  });
});
