import { describe, expect, test } from 'vitest';
import { evaluateCompat, MIN_SERVER_VERSION, MIN_SERVER_VERSION_NATIVE_FEATURES } from './compat';

describe('evaluateCompat', () => {
  test('null version → unknown', () => {
    expect(evaluateCompat(null)).toBe('unknown');
  });
  test('below the floor → too-old', () => {
    expect(evaluateCompat('0.0.5', '0.1.0', null)).toBe('too-old');
  });
  test('between floor and native threshold → native-unavailable', () => {
    expect(evaluateCompat('0.2.0', '0.1.0', '0.3.0')).toBe('native-unavailable');
  });
  test('at or above the native threshold → ok', () => {
    expect(evaluateCompat('0.3.0', '0.1.0', '0.3.0')).toBe('ok');
  });
  test('native layer dormant when threshold is null → ok', () => {
    expect(evaluateCompat('0.5.0', '0.1.0', null)).toBe('ok');
  });
  test('shipped defaults treat a normal version as ok', () => {
    expect(evaluateCompat('0.1.0')).toBe('ok');
  });
  test('shipped defaults: floor is permissive, native layer dormant', () => {
    expect(MIN_SERVER_VERSION).toBe('0.0.0');
    expect(MIN_SERVER_VERSION_NATIVE_FEATURES).toBeNull();
  });
});
