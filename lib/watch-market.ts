import { and, eq, sql } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { getDb } from '../db';
import { records } from '../db/schema';
import { baseReference, failureStatus, fetchLiveListings, forumItemsNeedingPost, matchForumItems, parseForumRss, safeFetch, WATCHUSEEK_FEED, type ForumItem, type SourceStatus } from './collectors';
import { mergeListings, reclassifyListings, type ArchivedListing } from './listing-archive';
import { collectPhillips } from './phillips';
import { collectAuctionSources } from './auction-sources';
import type { Model } from './market';

export const MARKET_OWNER = '__market__';
export type MarketArchive = { modelId: string; matchingVersion?: number; fetchedAt: string; partial: boolean; listings: ArchivedListing[]; sources: SourceStatus[]; threads: { title: string; url: string; date: string; source: string }[]; note: string };
const MATCHING_VERSION = 4;

export function currentArchiveMatches(archive: MarketArchive, model: Model): MarketArchive {
  return archive.matchingVersion === MATCHING_VERSION ? archive : { ...archive, matchingVersion: MATCHING_VERSION, listings: reclassifyListings(archive.listings, model) };
}

async function forumArchive() {
  const db = getDb();
  const lock = await db.insert(records).values({ id: `wus-check:${Math.floor(Date.now() / 1_800_000)}`, owner: '__feed__', kind: 'feed-check', payload: '{}' }).onConflictDoNothing().returning();
  let error: { message: string; status: 'blocked' | 'error' } | undefined;
  if (lock.length) {
    await db.delete(records).where(and(eq(records.kind, 'feed-check'), sql`${records.id} != ${lock[0].id}`));
    try {
      const items = parseForumRss(await safeFetch(WATCHUSEEK_FEED, { headers: { 'User-Agent': 'WatchLedger/1.0 (watch price tracker)', Accept: 'application/rss+xml' } }));
      const [first, ...rest] = items.map((it) => db.insert(records).values({ id: `wus:${it.id}`, owner: '__feed__', kind: 'feed:watchuseek', payload: JSON.stringify(it) }).onConflictDoUpdate({ target: records.id, set: { payload: JSON.stringify(it) } }));
      if (first) await db.batch([first, ...rest]);
    } catch (e) { error = { message: e instanceof Error ? e.message : 'WatchUSeek feed unavailable', status: failureStatus(e) }; }
  }
  const rows = await db.select().from(records).where(and(eq(records.owner, '__feed__'), eq(records.kind, 'feed:watchuseek')));
  return { items: rows.map((r) => JSON.parse(r.payload) as ForumItem), error };
}

export async function watchMarket(model: Model, owner = MARKET_OWNER, refresh = false): Promise<MarketArchive> {
  const db = getDb(), id = `market:${owner}:${model.id}`;
  const previousRow = await db.select().from(records).where(eq(records.id, id)).get();
  const previous = previousRow ? currentArchiveMatches(JSON.parse(previousRow.payload), model) : undefined;
  if (previous && !refresh && Date.now() - +new Date(previous.fetchedAt) < (previous.partial ? 120_000 : 1_200_000)) return previous;
  const lockId = `market-lock:${owner}:${model.id}`, lockPayload = JSON.stringify({ expiresAt: Date.now() + 120_000 });
  const lock = await db.insert(records).values({ id: lockId, owner, kind: 'market-lock', payload: lockPayload }).onConflictDoUpdate({ target: records.id, set: { payload: lockPayload }, setWhere: sql`json_extract(${records.payload}, '$.expiresAt') < ${Date.now()}` }).returning();
  if (!lock.length) {
    if (previous) return previous;
    throw new Error('This watch is being collected. Try again shortly.');
  }
  try {
    const [live, auction, forum, moreAuctions] = await Promise.allSettled([fetchLiveListings(model, env as any), collectPhillips(model), forumArchive(), collectAuctionSources(model)]);
    const listings = live.status === 'fulfilled' ? live.value.listings : [];
    const sources: SourceStatus[] = live.status === 'fulfilled' ? live.value.sources : [{ id: 'marketplaces', name: 'Marketplaces', status: 'error', count: 0, message: 'Marketplace check failed; retained observations are shown.' }];
    if (moreAuctions.status === 'fulfilled') { listings.push(...moreAuctions.value.listings); sources.push(...moreAuctions.value.sources); }
    else sources.push({ id: 'auctions', name: 'Additional auctions', status: 'error', count: 0, message: 'Auction checks failed; retained observations are shown.' });
    if (auction.status === 'fulfilled') { listings.push(...auction.value.listings); sources.push(auction.value.source); }
    else sources.push({ id: 'phillips', name: 'Phillips auctions', status: failureStatus(auction.reason), count: 0, message: auction.reason instanceof Error ? auction.reason.message : 'Auction results unavailable', searchUrl: `https://www.phillips.com/search?${new URLSearchParams({ search: baseReference(model.reference) })}` });
    let threads: MarketArchive['threads'] = [];
    if (forum.status === 'fulfilled') {
      const { items, error } = forum.value;
      const matches = matchForumItems(items, model, 'watchuseek');
      listings.push(...matches);
      threads = forumItemsNeedingPost(items, model).map((it) => ({ title: it.title, url: it.url, date: it.date, source: 'WatchUSeek' }));
      sources.push({ id: 'watchuseek', name: 'WatchUSeek', count: matches.length, status: error?.status || 'ok', message: error?.message || `Matched ${items.length} archived sale threads.`, searchUrl: WATCHUSEEK_FEED.replace('/index.rss', '/') });
    } else sources.push({ id: 'watchuseek', name: 'WatchUSeek', status: 'error', count: 0, message: 'Forum check failed; retained observations are shown.' });
    const body: MarketArchive = { modelId: model.id, matchingVersion: MATCHING_VERSION, fetchedAt: new Date().toISOString(), // Persistently blocked sources are reported but do not shorten the cache: only transient failures retry sooner.
      partial: sources.some((s) => s.status === 'error'), listings: mergeListings(previous?.listings || [], listings), sources, threads, note: 'Complete-reference matches and same-reference listings that do not state the variant enter the market price; the latter are labelled. Similar models are separate. Missing listings retain their last observed status; disappearance never proves a sale.' };
    await db.insert(records).values({ id, owner, kind: 'market-history', payload: JSON.stringify(body) }).onConflictDoUpdate({ target: records.id, set: { payload: JSON.stringify(body) } });
    return body;
  } finally { await db.delete(records).where(and(eq(records.id, lockId), eq(records.payload, lockPayload))); }
}
