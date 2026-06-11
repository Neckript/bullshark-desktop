import { describe, expect, test } from 'vitest';
import { compareVersions } from './version';

describe('compareVersions', () => {
  test('orders by major, minor, patch numerically', () => {
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('0.1.0', '0.2.0')).toBe(-1);
    expect(compareVersions('2.0.0', '10.0.0')).toBe(-1);
  });
  test('treats missing patch as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
  });
  test('ignores a leading v', () => {
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
  });
  test('a pre-release sorts below the same released version', () => {
    expect(compareVersions('0.1.0-alpha', '0.1.0')).toBe(-1);
    expect(compareVersions('0.1.0', '0.1.0-alpha')).toBe(1);
  });
  test('compares pre-release identifiers lexically', () => {
    expect(compareVersions('0.1.0-alpha', '0.1.0-beta')).toBe(-1);
  });
  test('garbage input does not throw and sorts as zeros', () => {
    expect(compareVersions('garbage', '0.0.0')).toBe(0);
  });
});
