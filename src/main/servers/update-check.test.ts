import { describe, expect, test } from 'vitest';
import { shouldNotifyUpdate } from './update-check';

describe('shouldNotifyUpdate', () => {
  test('server strictly newer than loaded, not yet notified → true', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: '0.1.0', currentVersion: '0.1.1', notifiedVersion: null })
    ).toBe(true);
  });

  test('server equal to loaded → false', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: '0.1.1', currentVersion: '0.1.1', notifiedVersion: null })
    ).toBe(false);
  });

  test('server older than loaded → false', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: '0.2.0', currentVersion: '0.1.0', notifiedVersion: null })
    ).toBe(false);
  });

  test('currentVersion null (fetch failed) → false', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: '0.1.0', currentVersion: null, notifiedVersion: null })
    ).toBe(false);
  });

  test('loadedVersion null (baseline unknown) → false', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: null, currentVersion: '0.1.1', notifiedVersion: null })
    ).toBe(false);
  });

  test('newer but already notified for that exact version (dedup) → false', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: '0.1.0', currentVersion: '0.1.1', notifiedVersion: '0.1.1' })
    ).toBe(false);
  });

  test('newer than loaded AND newer than a stale notifiedVersion → true', () => {
    expect(
      shouldNotifyUpdate({ loadedVersion: '0.1.0', currentVersion: '0.1.2', notifiedVersion: '0.1.1' })
    ).toBe(true);
  });
});
