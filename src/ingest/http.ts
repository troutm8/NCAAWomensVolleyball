/** Small fetch wrapper: per-host serialization with a minimum gap, retries, timeout. */

type HostState = { chain: Promise<void>; last: number };
const hosts = new Map<string, HostState>();

const DEFAULT_GAPS: Record<string, number> = {
  "ncaa-api.henrygd.me": 300,
  "site.api.espn.com": 120,
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class HttpError extends Error {
  constructor(public status: number, public url: string, public body: string) {
    super(`HTTP ${status} for ${url}: ${body.slice(0, 200)}`);
  }
}

export async function fetchJson(
  url: string,
  opts: { retries?: number; timeoutMs?: number; minGapMs?: number } = {},
): Promise<unknown> {
  const { retries = 3, timeoutMs = 20_000 } = opts;
  const host = new URL(url).host;
  const gap = opts.minGapMs ?? DEFAULT_GAPS[host] ?? 100;
  const state = hosts.get(host) ?? { chain: Promise.resolve(), last: 0 };
  hosts.set(host, state);

  const run = async (): Promise<unknown> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const wait = state.last + gap - Date.now();
      if (wait > 0) await sleep(wait);
      state.last = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { "user-agent": "wvb-dashboard/0.1 (personal project)", accept: "application/json" },
        });
        const text = await res.text();
        if (!res.ok) {
          if (res.status === 404) throw new HttpError(404, url, text);
          throw new HttpError(res.status, url, text);
        }
        try {
          return JSON.parse(text);
        } catch {
          throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 120)}`);
        }
      } catch (err) {
        lastErr = err;
        if (err instanceof HttpError && err.status === 404) throw err;
        if (attempt < retries) await sleep(500 * 2 ** attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
  };

  const result = state.chain.then(run, run);
  state.chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
