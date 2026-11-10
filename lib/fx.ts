import { waitUntil } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { records } from '../db/schema';
import { parseEcbRates, type Fx } from './market';

// ECB euro reference rates, published once per working day. Frankfurter republishes the same ECB data as JSON
// and is used when the ECB host cannot be reached. Kept per isolate and in D1, and renewed after 6 hours in the
// background: a request only waits for the ECB when no rates have ever been stored.
type Cached = { at: number; fx: Fx; source: string };
let cached: Cached | null = null;
let renewing: Promise<Cached | null> | null = null;
const MAX_AGE = 6 * 3600_000;
const FX_ID = 'fx:ecb';
const headers = { 'User-Agent': 'WatchLedger/1.0 (personal watch price tracker)' };

async function fromEcb(): Promise<Fx | null> {
  const r = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', { headers, signal: AbortSignal.timeout(10_000) });
  return r.ok ? parseEcbRates(await r.text()) : null;
}

async function fromFrankfurter(): Promise<Fx | null> {
  const r = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR', { headers, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) return null;
  const d = (await r.json()) as { date?: unknown; rates?: Record<string, number> };
  return typeof d?.date === 'string' && d.rates && typeof d.rates.USD === 'number' ? { date: d.date, rates: { EUR: 1, ...d.rates } } : null;
}

async function download(): Promise<Cached | null> {
  for (const [source, load] of [['European Central Bank', fromEcb], ['European Central Bank via Frankfurter', fromFrankfurter]] as const) {
    try {
      const fx = await load();
      if (fx) {
        const fresh = { at: Date.now(), fx, source };
        const payload = JSON.stringify(fresh);
        await getDb()
          .insert(records)
          .values({ id: FX_ID, owner: '__market__', kind: 'fx', payload })
          .onConflictDoUpdate({ target: records.id, set: { payload } })
          .catch(() => undefined);
        return fresh;
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn(`${source} rates error`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}

/** One download at a time per isolate; the result replaces the cache only when a source answered. */
function renew() {
  renewing ??= download()
    .then((fresh) => (cached = fresh || cached))
    .finally(() => (renewing = null));
  return renewing;
}

/** Current ECB rates (EUR base) and where they came from, or null when no source answers. */
export async function getFx(): Promise<{ fx: Fx; source: string } | null> {
  if (!cached) {
    const row = await getDb().select({ payload: records.payload }).from(records).where(eq(records.id, FX_ID)).get().catch(() => undefined);
    if (row) cached = JSON.parse(row.payload) as Cached;
  }
  if (!cached) return renew();
  if (Date.now() - cached.at > MAX_AGE) waitUntil(renew());
  return cached;
}
