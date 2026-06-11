import { describe, expect, test } from 'vitest';
import { classifyProbeError, probeServer } from './validate';

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

describe('classifyProbeError', () => {
  test('cert errors → cert-untrusted', () => {
    expect(classifyProbeError({ cause: { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' } })).toBe('cert-untrusted');
    expect(classifyProbeError(new Error('unable to verify the first certificate'))).toBe('cert-untrusted');
  });
  test('DNS errors → dns-failure', () => {
    expect(classifyProbeError({ code: 'ENOTFOUND' })).toBe('dns-failure');
    expect(classifyProbeError({ cause: { code: 'EAI_AGAIN' } })).toBe('dns-failure');
  });
  test('refused → connection-refused', () => {
    expect(classifyProbeError({ cause: { code: 'ECONNREFUSED' } })).toBe('connection-refused');
  });
  test('abort/timeout → timeout', () => {
    expect(classifyProbeError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe('timeout');
  });
  test('anything else → unreachable', () => {
    expect(classifyProbeError(new Error('weird'))).toBe('unreachable');
  });
});

describe('probeServer reason codes', () => {
  test('5xx → server-error', async () => {
    const res = await probeServer('https://a.com', async () => ({ ok: false, status: 503 }) as Response);
    expect(res.reason).toBe('server-error');
  });
  test('thrown DNS error → dns-failure', async () => {
    const res = await probeServer('https://a.com', async () => { throw { code: 'ENOTFOUND' }; });
    expect(res).toEqual({ reachable: false, reason: 'dns-failure' });
  });
});
