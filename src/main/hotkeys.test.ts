import { describe, expect, test } from 'vitest';
import { DEFAULT_MUTE_HOTKEY } from '../shared/types';
import { applyHotkeys, resolveMuteHotkey, type HotkeyRegistrar } from './hotkeys';

const fakeRegistrar = (registerResult: boolean | 'throw' = true) => {
  const calls: { registered: string[]; unregisterAllCount: number } = { registered: [], unregisterAllCount: 0 };
  const registrar: HotkeyRegistrar = {
    register: (accelerator) => {
      if (registerResult === 'throw') throw new Error('invalid accelerator');
      calls.registered.push(accelerator);
      return registerResult;
    },
    unregisterAll: () => { calls.unregisterAllCount += 1; }
  };
  return { registrar, calls };
};

describe('resolveMuteHotkey', () => {
  test('non-string values fall back to the default', () => {
    expect(resolveMuteHotkey(undefined)).toBe(DEFAULT_MUTE_HOTKEY);
    expect(resolveMuteHotkey(42)).toBe(DEFAULT_MUTE_HOTKEY);
  });
  test('empty or whitespace-only string means disabled (null)', () => {
    expect(resolveMuteHotkey('')).toBeNull();
    expect(resolveMuteHotkey('   ')).toBeNull();
  });
  test('a custom accelerator is returned trimmed', () => {
    expect(resolveMuteHotkey(' Alt+F10 ')).toBe('Alt+F10');
  });
});

describe('applyHotkeys', () => {
  test('always clears previous registrations first', () => {
    const { registrar, calls } = fakeRegistrar();
    applyHotkeys([{ accelerator: null, onTrigger: () => {} }], registrar);
    expect(calls.unregisterAllCount).toBe(1);
  });
  test('disabled (null) bindings register nothing and report success', () => {
    const { registrar, calls } = fakeRegistrar();
    expect(
      applyHotkeys(
        [
          { accelerator: null, onTrigger: () => {} },
          { accelerator: null, onTrigger: () => {} }
        ],
        registrar
      )
    ).toBe(true);
    expect(calls.registered).toEqual([]);
  });
  test('registers every enabled accelerator together', () => {
    const { registrar, calls } = fakeRegistrar();
    expect(
      applyHotkeys(
        [
          { accelerator: 'Alt+M', onTrigger: () => {} },
          { accelerator: 'Alt+O', onTrigger: () => {} }
        ],
        registrar
      )
    ).toBe(true);
    // A single unregisterAll pass, then both registered.
    expect(calls.unregisterAllCount).toBe(1);
    expect(calls.registered).toEqual(['Alt+M', 'Alt+O']);
  });
  test('wires each trigger to its accelerator', () => {
    const { calls } = fakeRegistrar();
    let muteFired = 0;
    let overlayFired = 0;
    const registrar: HotkeyRegistrar = {
      register: (a, cb) => {
        calls.registered.push(a);
        cb();
        return true;
      },
      unregisterAll: () => {}
    };
    applyHotkeys(
      [
        { accelerator: 'Alt+M', onTrigger: () => { muteFired += 1; } },
        { accelerator: 'Alt+O', onTrigger: () => { overlayFired += 1; } }
      ],
      registrar
    );
    expect(muteFired).toBe(1);
    expect(overlayFired).toBe(1);
  });
  test('reports failure when a registration is refused', () => {
    const { registrar } = fakeRegistrar(false);
    expect(
      applyHotkeys([{ accelerator: 'Alt+M', onTrigger: () => {} }], registrar)
    ).toBe(false);
  });
  test('reports failure instead of throwing on an invalid accelerator', () => {
    const { registrar } = fakeRegistrar('throw');
    expect(
      applyHotkeys([{ accelerator: 'Not A Key', onTrigger: () => {} }], registrar)
    ).toBe(false);
  });
});
