import { describe, expect, test } from 'vitest';
import { selectUpdaterKind } from './index';

describe('selectUpdaterKind', () => {
  test('windows uses native electron-updater', () => {
    expect(selectUpdaterKind('win32', false)).toBe('native');
  });
  test('linux uses native electron-updater', () => {
    expect(selectUpdaterKind('linux', false)).toBe('native');
  });
  test('unsigned macOS uses github fallback', () => {
    expect(selectUpdaterKind('darwin', false)).toBe('github-fallback');
  });
  test('signed macOS uses native', () => {
    expect(selectUpdaterKind('darwin', true)).toBe('native');
  });
});
