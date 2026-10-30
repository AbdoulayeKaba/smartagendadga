export type FetchJsonResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; data?: unknown };

type FetchJsonInit = RequestInit & { timeoutMs?: number };

export async function fetchJson<T = Record<string, unknown>>(
  input: RequestInfo | URL,
  init?: FetchJsonInit
): Promise<FetchJsonResult<T>> {
  const timeoutMs = init?.timeoutMs ?? 20_000;
  const { timeoutMs: _timeout, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, { ...fetchInit, signal: controller.signal });
    const data = (await res.json().catch(() => ({}))) as T;
    if (!res.ok) {
      const err =
        typeof data === 'object' && data !== null && 'error' in data
          ? String((data as { error?: unknown }).error ?? res.status)
          : String(res.status);
      return { ok: false, status: res.status, error: err, data };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, status: 0, error: 'TIMEOUT' };
    }
    return { ok: false, status: 0, error: 'NETWORK' };
  } finally {
    clearTimeout(timer);
  }
}
