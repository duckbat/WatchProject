import { parseEcbRates, type Fx } from '../../../lib/market';

// ECB euro reference rates, published once per working day. Frankfurter republishes the same ECB data as JSON
// and is used when the ECB host cannot be reached. Cached per isolate for 6 hours.
let cached: { at: number; fx: Fx; source: string } | null = null;
const headers = { 'User-Agent': 'WatchLedger/1.0 (personal watch price tracker)' };

async function fromEcb(): Promise<Fx | null> {
  const r = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', { headers, signal: AbortSignal.timeout(10_000) });
  return r.ok ? parseEcbRates(await r.text()) : null;
}
async function fromFrankfurter(): Promise<Fx | null> {
  const r = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR', { headers, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) return null;
  const d: any = await r.json();
  return typeof d?.date === 'string' && d.rates && typeof d.rates.USD === 'number' ? { date: d.date, rates: { EUR: 1, ...d.rates } } : null;
}

export async function GET() {
  if (!cached || Date.now() - cached.at > 6 * 3600_000) {
    for (const [source, load] of [['European Central Bank', fromEcb], ['European Central Bank via Frankfurter', fromFrankfurter]] as const) {
      try {
        const fx = await load();
        if (fx) { cached = { at: Date.now(), fx, source }; break; }
      } catch (e) {
        if (import.meta.env.DEV) console.warn(`${source} rates error`, e instanceof Error ? e.message : e);
      }
    }
  }
  if (!cached) return Response.json({ error: 'Exchange rates unavailable' }, { status: 503 });
  return Response.json({ ...cached.fx, source: cached.source }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
