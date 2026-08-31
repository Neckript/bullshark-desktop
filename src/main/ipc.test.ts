import { describe, expect, test, vi } from 'vitest';
import { app, ipcMain, shell } from '../test/electron-stub';
import { IPC } from '../shared/ipc';
import { registerIpc } from './ipc';
import type { createServerStore } from './servers/store';

type Store = ReturnType<typeof createServerStore>;

describe('registerIpc', () => {
  test('wires app:version to app.getVersion()', () => {
    // registerIpc only registers callbacks at call time; none of them touch
    // the store synchronously, so an empty fake is everything this call needs.
    registerIpc({} as unknown as Store);

    const handler = ipcMain.handlers.get(IPC.appVersion);
    expect(typeof handler).toBe('function');
    expect((handler as () => string)()).toBe(app.getVersion());
  });

  test('app:repository maps each closed-list key to its own host', () => {
    registerIpc({} as unknown as Store);

    const spy = vi.spyOn(shell, 'openExternal');
    const handler = ipcMain.handlers.get(IPC.appRepository) as (
      e: unknown,
      arg: unknown
    ) => void;
    expect(typeof handler).toBe('function');

    handler(undefined, 'codeberg');
    handler(undefined, 'github');

    expect(spy.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining('codeberg.org'),
      expect.stringContaining('github.com')
    ]);
    spy.mockRestore();
  });

  test('app:repository opens nothing for a key outside the list', () => {
    registerIpc({} as unknown as Store);

    const spy = vi.spyOn(shell, 'openExternal');
    const handler = ipcMain.handlers.get(IPC.appRepository) as (
      e: unknown,
      arg: unknown
    ) => void;

    // Le renderer ne transmet jamais d'URL : une URL passee en argument doit
    // etre refusee comme n'importe quelle cle inconnue.
    handler(undefined, 'https://evil.example');
    handler(undefined, undefined);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
