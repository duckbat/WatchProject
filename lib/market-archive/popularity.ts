import { sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { findCatalogModel } from '../catalog';
import { exactMatch } from '../collectors/matching/classify';
import { baseReference } from '../collectors/matching/reference';
import { getFx } from '../fx';
import { summarizeMarkets, type MarketSummary, type PricedRow } from './summary';
import { MARKET_OWNER } from './watch-market';

/** Per-watch market summaries for search ranking and card prices, rebuilt at most every 10 minutes per isolate. */
let cached: { at: number; summaries: Map<string, MarketSummary> } | null = null;

export async function marketSummaries(): Promise<Map<string, MarketSummary>> {
  if (cached && Date.now() - cached.at < 600_000) return cached.summaries;
  try {
    // Only the priced listings leave D1, not the whole archives.
    const rows = await getDb().all<PricedRow & { matchDetails?: string | null }>(sql`
      SELECT json_extract(r.payload, '$.modelId') AS modelId,
             json_extract(l.value, '$.price') AS price,
             json_extract(l.value, '$.currency') AS currency,
             json_extract(l.value, '$.status') AS status,
             json_extract(l.value, '$.match') AS match,
             json_extract(l.value, '$.sourceId') AS sourceId,
             json_extract(l.value, '$.observedAt') AS observedAt,
             json_extract(l.value, '$.listedAt') AS listedAt,
             json_extract(l.value, '$.title') AS title,
             json_extract(l.value, '$.matchDetails') AS matchDetails
      FROM records r, json_each(r.payload, '$.listings') l
      WHERE r.owner = ${MARKET_OWNER} AND r.kind = 'market-history'`);
    // "Similar" listings of another dial still name the base reference: they count toward the all-dials price.
    const sameReference = (r: PricedRow & { matchDetails?: string | null }) => {
      if (r.match !== 'similar') return true;
      const model = findCatalogModel(r.modelId);
      return Boolean(model && r.title && exactMatch(r.title, { brand: model.brand, reference: baseReference(model.reference) }, r.matchDetails ?? ''));
    };
    const priced = rows.filter((r) => typeof r.modelId === 'string' && Number(r.price) > 0 && sameReference(r));
    cached = { at: Date.now(), summaries: summarizeMarkets(priced, (await getFx())?.fx ?? null) };
  } catch {
    // Search still works without the database; it just loses ranking and card prices. Retry in a minute.
    cached = { at: Date.now() - 540_000, summaries: cached?.summaries || new Map() };
  }
  return cached.summaries;
}

/** Priced observations per watch (search ranking). */
export async function marketPopularity(): Promise<Map<string, number>> {
  return new Map([...(await marketSummaries())].map(([id, s]) => [id, s.priced]));
}
