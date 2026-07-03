import { describe, expect, test } from 'vitest';
import { eventToAccelerator } from './hotkey-capture';

const ev = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods
});

describe('eventToAccelerator', () => {
  test('modifier-only presses are rejected', () => {
    expect(eventToAccelerator(ev('Control', { ctrlKey: true }))).toBeNull();
    expect(eventToAccelerator(ev('Shift', { shiftKey: true }))).toBeNull();
    expect(eventToAccelerator(ev('Meta', { metaKey: true }))).toBeNull();
    expect(eventToAccelerator(ev('Alt', { altKey: true }))).toBeNull();
  });
  test('bare keys are rejected (unsafe as global hotkeys)', () => {
    expect(eventToAccelerator(ev('m'))).toBeNull();
    expect(eventToAccelerator(ev('m', { shiftKey: true }))).toBeNull(); // shift alone is not enough
  });
  test('function keys are allowed without modifiers', () => {
    expect(eventToAccelerator(ev('F10'))).toBe('F10');
    expect(eventToAccelerator(ev('F24'))).toBe('F24');
  });
  test('letters are uppercased and modifiers ordered', () => {
    expect(eventToAccelerator(ev('m', { ctrlKey: true, shiftKey: true }))).toBe('CommandOrControl+Shift+M');
    expect(eventToAccelerator(ev('m', { altKey: true }))).toBe('Alt+M');
  });
  test('cmd maps to CommandOrControl like ctrl', () => {
    expect(eventToAccelerator(ev('k', { metaKey: true }))).toBe('CommandOrControl+K');
  });
  test('named keys are translated to accelerator names', () => {
    expect(eventToAccelerator(ev(' ', { ctrlKey: true }))).toBe('CommandOrControl+Space');
    expect(eventToAccelerator(ev('ArrowUp', { altKey: true }))).toBe('Alt+Up');
  });
  test('unmappable named keys are rejected', () => {
    expect(eventToAccelerator(ev('CapsLock', { ctrlKey: true }))).toBeNull();
  });
});
