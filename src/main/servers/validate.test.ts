import { describe, expect, test } from 'vitest';
import { probeServer } from './validate';

describe('probeServer', () => {
  test('ok when fetch resolves with ok response', async () => {
    const res = await probeServer('https://a.com', async () => ({ ok: true, status: 200 }) as Response);
    expect(res.reachable).toBe(true);
  });
  test('unreachable when fetch throws', async () => {
    const res = await probeServer('https://a.com', async () => { throw new Error('ENOTFOUND'); });
    expect(res.reachable).toBe(false);
  });
  test('unreachable on 5xx', async () => {
    const res = await probeServer('https://a.com', async () => ({ ok: false, status: 502 }) as Response);
    expect(res.reachable).toBe(false);
  });
});
