import { describe, expect, test } from 'vitest';
import { DEFAULT_MUTE_HOTKEY } from '../shared/types';
import { applyMuteHotkey, resolveMuteHotkey, type HotkeyRegistrar } from './hotkeys';

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

describe('applyMuteHotkey', () => {
  test('always clears previous registrations first', () => {
    const { registrar, calls } = fakeRegistrar();
    applyMuteHotkey(null, registrar, () => {});
    expect(calls.unregisterAllCount).toBe(1);
  });
  test('disabled (null) registers nothing and reports success', () => {
    const { registrar, calls } = fakeRegistrar();
    expect(applyMuteHotkey(null, registrar, () => {})).toBe(true);
    expect(calls.registered).toEqual([]);
  });
  test('registers the accelerator and wires the trigger', () => {
    const { registrar, calls } = fakeRegistrar();
    let fired = 0;
    expect(applyMuteHotkey('Alt+M', { ...registrar, register: (a, cb) => { calls.registered.push(a); cb(); fired += 1; return true; } }, () => { fired += 10; })).toBe(true);
    expect(calls.registered).toEqual(['Alt+M']);
    expect(fired).toBe(11); // callback invoked once by the fake, trigger ran
  });
  test('reports failure when registration is refused', () => {
    const { registrar } = fakeRegistrar(false);
    expect(applyMuteHotkey('Alt+M', registrar, () => {})).toBe(false);
  });
  test('reports failure instead of throwing on an invalid accelerator', () => {
    const { registrar } = fakeRegistrar('throw');
    expect(applyMuteHotkey('Not A Key', registrar, () => {})).toBe(false);
  });
});
