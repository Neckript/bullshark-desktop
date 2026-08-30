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

  test('wires app:repository to shell.openExternal with a fixed URL, ignoring any argument', () => {
    registerIpc({} as unknown as Store);

    const spy = vi.spyOn(shell, 'openExternal');
    const handler = ipcMain.handlers.get(IPC.appRepository);
    expect(typeof handler).toBe('function');

    (handler as (e: unknown, arg: unknown) => void)(undefined, 'https://evil.example');

    expect(spy).toHaveBeenCalledTimes(1);
    const [url] = spy.mock.calls[0];
    expect(url).not.toBe('https://evil.example');
    expect(url).toMatch(/^https:\/\//);
  });
});
