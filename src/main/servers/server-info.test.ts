import { describe, expect, test } from 'vitest';
import { fetchServerInfo } from './server-info';

const resp = (status: number, body: unknown): Response =>
  ({ status, json: async () => body }) as unknown as Response;

describe('fetchServerInfo', () => {
  test('returns the version from a 200 /info payload', async () => {
    const r = await fetchServerInfo('https://a.com', async () => resp(200, { version: '0.1.0', name: 'x' }));
    expect(r).toEqual({ version: '0.1.0' });
  });
  test('requests the /info path on the base URL', async () => {
    let called = '';
    await fetchServerInfo('https://a.com', async (url) => { called = url; return resp(200, { version: '1.0.0' }); });
    expect(called).toBe('https://a.com/info');
  });
  test('null on non-2xx', async () => {
    expect(await fetchServerInfo('https://a.com', async () => resp(404, {}))).toBeNull();
  });
  test('null when fetch throws', async () => {
    expect(await fetchServerInfo('https://a.com', async () => { throw new Error('boom'); })).toBeNull();
  });
  test('null when version is missing or not a string', async () => {
    expect(await fetchServerInfo('https://a.com', async () => resp(200, { name: 'x' }))).toBeNull();
    expect(await fetchServerInfo('https://a.com', async () => resp(200, { version: 12 }))).toBeNull();
  });
});
