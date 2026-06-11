export type ProbeReason =
  | 'cert-untrusted'
  | 'dns-failure'
  | 'connection-refused'
  | 'timeout'
  | 'server-error'
  | 'unreachable';

export type ProbeResult = { reachable: boolean; status?: number; reason?: ProbeReason };
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const classifyProbeError = (err: unknown): Exclude<ProbeReason, 'server-error'> => {
  const e = err as { code?: string; name?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = e?.code ?? e?.cause?.code ?? '';
  const name = e?.name ?? '';
  const msg = `${e?.message ?? ''} ${e?.cause?.message ?? ''}`;

  if (name === 'AbortError' || name === 'TimeoutError' || code === 'UND_ERR_CONNECT_TIMEOUT') return 'timeout';
  if (code === 'ECONNREFUSED') return 'connection-refused';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'dns-failure';
  if (code.includes('CERT') || /self.?signed|certificate|unable to verify/i.test(msg)) return 'cert-untrusted';
  return 'unreachable';
};

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
    return { reachable: false, reason: classifyProbeError(e) };
  } finally {
    clearTimeout(timer);
  }
};
