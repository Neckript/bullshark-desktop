export type ProbeResult = { reachable: boolean; status?: number; reason?: string };
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const probeServer = async (
  url: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 5000
): Promise<ProbeResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: 'GET', signal: controller.signal });
    if (res.status >= 500) return { reachable: false, status: res.status, reason: 'server-error' };
    return { reachable: true, status: res.status };
  } catch (e) {
    return { reachable: false, reason: e instanceof Error ? e.message : 'unknown' };
  } finally {
    clearTimeout(timer);
  }
};
