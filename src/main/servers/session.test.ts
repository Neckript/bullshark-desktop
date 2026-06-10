import { describe, expect, test } from 'vitest';
import { partitionForServer } from './session';

describe('partitionForServer', () => {
  test('builds a persistent per-server partition', () => {
    expect(partitionForServer('abc')).toBe('persist:server-abc');
  });
});
