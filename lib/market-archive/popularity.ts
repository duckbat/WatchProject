import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { records } from '../../db/schema';
import { MARKET_OWNER } from './watch-market';

/** Priced (non-similar) market observations per catalog watch, counted inside D1 so archives are never shipped whole. */
let cached: { at: number; counts: Map<string, number> } | null = null;

export async function marketPopularity(): Promise<Map<string, number>> {
  if (cached && Date.now() - cached.at < 600_000) return cached.counts;
  try {
    const rows = await getDb()
      .select({
        modelId: sql<string>`json_extract(${records.payload}, '$.modelId')`,
        priced: sql<number>`(SELECT count(*) FROM json_each(${records.payload}, '$.listings') WHERE json_extract(value, '$.match') != 'similar')`,
      })
      .from(records)
      .where(and(eq(records.owner, MARKET_OWNER), eq(records.kind, 'market-history')));
    cached = {
      at: Date.now(),
      counts: new Map(
        rows.filter((r) => typeof r.modelId === 'string' && r.priced > 0).map((r) => [r.modelId, Number(r.priced)]),
      ),
    };
  } catch {
    // Search still works without the database; it just loses the popularity ordering.
    cached = { at: Date.now() - 540_000, counts: cached?.counts || new Map() };
  }
  return cached.counts;
}
