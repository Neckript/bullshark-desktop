import { describe, expect, test } from 'vitest';
import { getForgejoFeedUrl } from './forgejo-feed';

const fetchReturning = (status: number, body: unknown): typeof fetch =>
  (() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body)
    } as Response)) as typeof fetch;

describe('getForgejoFeedUrl', () => {
  test('returns the download URL for the latest tag', async () => {
    const url = await getForgejoFeedUrl({
      fetch: fetchReturning(200, { tag_name: 'v0.1.5' })
    });
    expect(url).toBe(
      'https://codeberg.org/The_Neckript/bullshark-desktop/releases/download/v0.1.5'
    );
  });
  test('throws on a non-OK response', async () => {
    await expect(
      getForgejoFeedUrl({ fetch: fetchReturning(404, {}) })
    ).rejects.toThrow();
  });
  test('propagates network errors', async () => {
    const failingFetch = (() => Promise.reject(new Error('offline'))) as typeof fetch;
    await expect(getForgejoFeedUrl({ fetch: failingFetch })).rejects.toThrow('offline');
  });
  test('throws when tag_name is missing from the response', async () => {
    await expect(
      getForgejoFeedUrl({ fetch: fetchReturning(200, {}) })
    ).rejects.toThrow();
  });
});
