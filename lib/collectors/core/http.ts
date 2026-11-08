import { CollectorError } from './errors';

const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 15_000;

/**
 * Hosts that answered 403 (blocked) or 429 (rate-limited) are left alone for 30 minutes in this isolate, instead of
 * being asked again on every watch refresh. 401 is a credentials problem, not a block, so it does not count.
 */
const BACKOFF_MS = 30 * 60_000;
const backoff = new Map<string, { until: number; status: number }>();

const blocked = (status: number) =>
  new CollectorError(
    'blocked',
    `Source returned HTTP ${status} (access blocked or rate-limited). No data was imported.`,
  );

/** GET/POST a fixed provider URL with a timeout, no redirects and a response size cap. Returns the body as text. */
export async function safeFetch(url: string, init: RequestInit = {}, fetcher: typeof fetch = fetch) {
  // Only fixed provider URLs reach this helper. User marketplace URLs are never fetched.
  // Backoff applies to real network calls only; tests pass their own fetcher.
  const host = new URL(url).host,
    live = fetcher === fetch;
  const held = live ? backoff.get(host) : undefined;
  if (held && held.until > Date.now()) throw blocked(held.status);
  const response = await fetcher(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (live && (response.status === 403 || response.status === 429))
    backoff.set(host, { until: Date.now() + BACKOFF_MS, status: response.status });
  if ([401, 403, 429].includes(response.status)) {
    await response.body?.cancel();
    throw blocked(response.status);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new CollectorError('upstream_error', `Source returned HTTP ${response.status}. No data was imported.`);
  }
  if (Number(response.headers.get('content-length')) > MAX_BYTES) {
    await response.body?.cancel();
    throw new CollectorError('too_large', 'Source response exceeds the collection limit.');
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  let size = 0;
  const decoder = new TextDecoder();
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new CollectorError('too_large', 'Source response exceeds the collection limit.');
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } finally {
    await reader.cancel();
  }
}
