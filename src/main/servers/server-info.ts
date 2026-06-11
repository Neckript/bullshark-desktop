type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

// Runs in the main process on the default session (CORS does not apply here).
// A server with an untrusted/self-signed certificate will reject and yield null
// -> verdict 'unknown' -> no banner. That is intentional: self-signed servers are
// an unsupported path (the app assumes a valid public cert), so the compat check
// degrades silently rather than firing a false warning.
export const fetchServerInfo = async (
  baseUrl: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 4000
): Promise<{ version: string } | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/info`, {
      method: 'GET',
      signal: controller.signal
    });
    if (res.status < 200 || res.status >= 300) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data?.version === 'string' ? { version: data.version } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
