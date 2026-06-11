type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

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
