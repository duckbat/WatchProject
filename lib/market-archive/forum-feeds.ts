import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { records } from '../../db/schema';
import { failureStatus, parseForumRss, safeFetch, type ForumFeed, type ForumItem } from '../collectors';

/** Forum sale threads are archived as they are read: each RSS feed only shows the newest 20-100 threads. */
export async function forumArchive(feed: ForumFeed) {
  const db = getDb(),
    kind = `feed:${feed.id}`;
  // One fetch per feed per 30 minutes across all page views (forums set crawl delays of 5-60 s).
  const lock = await db
    .insert(records)
    .values({
      id: `${feed.prefix}-check:${Math.floor(Date.now() / 1_800_000)}`,
      owner: '__feed__',
      kind: `feed-check:${feed.id}`,
      payload: '{}',
    })
    .onConflictDoNothing()
    .returning();
  let error: { message: string; status: 'blocked' | 'error' } | undefined;
  if (lock.length) {
    await db.delete(records).where(and(eq(records.kind, `feed-check:${feed.id}`), sql`${records.id} != ${lock[0].id}`));
    try {
      const items = parseForumRss(
        await safeFetch(feed.url, {
          headers: { 'User-Agent': 'WatchLedger/1.0 (watch price tracker)', Accept: 'application/rss+xml' },
        }),
        feed.host,
      );
      const [first, ...rest] = items.map((it) =>
        db
          .insert(records)
          .values({ id: `${feed.prefix}:${it.id}`, owner: '__feed__', kind, payload: JSON.stringify(it) })
          .onConflictDoUpdate({ target: records.id, set: { payload: JSON.stringify(it) } }),
      );
      if (first) await db.batch([first, ...rest]);
    } catch (e) {
      error = { message: e instanceof Error ? e.message : `${feed.name} feed unavailable`, status: failureStatus(e) };
    }
  }
  // Only the last year of threads is matched: older ones already live in each watch's own archive, and the feed
  // archive grows with every read.
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.owner, '__feed__'),
        eq(records.kind, kind),
        sql`json_extract(${records.payload}, '$.date') >= ${since}`,
      ),
    );
  return { items: rows.map((r) => JSON.parse(r.payload) as ForumItem), error };
}
