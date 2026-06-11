import { describe, expect, test } from 'vitest';
import { normalizeServerUrl } from './url';

describe('normalizeServerUrl', () => {
  test('adds https when scheme missing', () => {
    expect(normalizeServerUrl('chat.example.com')).toEqual({ ok: true, url: 'https://chat.example.com' });
  });
  test('rejects explicit http (remote)', () => {
    expect(normalizeServerUrl('http://chat.example.com')).toEqual({ ok: false, reason: 'http-not-allowed' });
  });
  test('rejects http on localhost (no exception)', () => {
    expect(normalizeServerUrl('http://localhost:4991').ok).toBe(false);
    expect(normalizeServerUrl('http://localhost:4991').reason).toBe('http-not-allowed');
  });
  test('rejects http on a bare IP', () => {
    expect(normalizeServerUrl('http://192.168.1.42:4991').reason).toBe('http-not-allowed');
  });
  test('defaults a bare host to https', () => {
    expect(normalizeServerUrl('192.168.1.42:4991')).toEqual({ ok: true, url: 'https://192.168.1.42:4991' });
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
