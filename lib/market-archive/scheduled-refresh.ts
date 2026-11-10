import { sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { records } from '../../db/schema';
import type { CatalogModel } from '../catalog';
import { planRefresh, type ArchiveAge } from './refresh-plan';
import { MARKET_OWNER, watchMarket } from './watch-market';

export * from './refresh-plan';

/** One scheduled run: refreshes up to `limit` due watches one after another (each is ~40 source requests). */
export async function runScheduledRefresh(find: (id: string) => CatalogModel | undefined, limit = 1) {
  const db = getDb();
  const archives = await db.all<ArchiveAge>(sql`
    SELECT json_extract(payload, '$.modelId') AS modelId, json_extract(payload, '$.fetchedAt') AS fetchedAt
    FROM records WHERE owner = ${MARKET_OWNER} AND kind = 'market-history'`);
  const failures = await db.all<ArchiveAge>(sql`
    SELECT json_extract(payload, '$.modelId') AS modelId, json_extract(payload, '$.at') AS fetchedAt
    FROM records WHERE owner = ${MARKET_OWNER} AND kind = 'refresh-failure'`);
  const { jobs, due } = planRefresh(archives.filter((a) => typeof a.modelId === 'string'), find, limit, Date.now(), failures.filter((f) => typeof f.modelId === 'string'));
  const refreshed = [];
  for (const job of jobs) {
    try {
      const result = await watchMarket(job.model, MARKET_OWNER, true, { ebay: job.ebay, background: true });
      refreshed.push({ modelId: job.model.id, reference: job.model.reference, reason: job.reason, ebay: job.ebay, count: result.listings.length, partial: result.partial });
    } catch (e) {
      const message = e instanceof Error ? e.message.slice(0, 300) : 'unknown error';
      // Remembered so the plan waits REFRESH_AFTER_MS before trying this watch again.
      const payload = JSON.stringify({ modelId: job.model.id, at: new Date().toISOString(), message });
      await db
        .insert(records)
        .values({ id: `refresh-failure:${job.model.id}`, owner: MARKET_OWNER, kind: 'refresh-failure', payload })
        .onConflictDoUpdate({ target: records.id, set: { payload } })
        .catch(() => undefined);
      refreshed.push({ modelId: job.model.id, reference: job.model.reference, reason: job.reason, ebay: job.ebay, error: `Collection failed; the previous archive is retained. ${message}` });
    }
  }
  return { refreshed, remaining: due - jobs.length };
}
