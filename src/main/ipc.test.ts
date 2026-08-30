import { describe, expect, test } from 'vitest';
import { app, ipcMain } from '../test/electron-stub';
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
});
