export type NormalizeResult = { ok: true; url: string } | { ok: false; reason: string };

export const normalizeServerUrl = (input: string): NormalizeResult => {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'scheme' };
  }

  const url = `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
  return { ok: true, url };
};
