import { describe, expect, test } from 'vitest';
import { normalizeServerUrl } from './url';

describe('normalizeServerUrl', () => {
  test('adds https when scheme missing', () => {
    expect(normalizeServerUrl('chat.example.com')).toEqual({ ok: true, url: 'https://chat.example.com' });
  });
  test('keeps http when explicit', () => {
    expect(normalizeServerUrl('http://localhost:4991')).toEqual({ ok: true, url: 'http://localhost:4991' });
  });
  test('strips trailing slash', () => {
    expect(normalizeServerUrl('https://a.com/')).toEqual({ ok: true, url: 'https://a.com' });
  });
  test('rejects empty', () => {
    expect(normalizeServerUrl('   ').ok).toBe(false);
  });
  test('rejects non-http(s) scheme', () => {
    expect(normalizeServerUrl('ftp://a.com').ok).toBe(false);
  });
});
