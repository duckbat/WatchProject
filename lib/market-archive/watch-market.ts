import { and, eq, sql } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { getDb } from '../../db';
import { records } from '../../db/schema';
import {
  baseReference,
  collectAuctionSources,
  collectPhillips,
  failureStatus,
  fetchLiveListings,
  FORUM_FEEDS,
  forumItemsNeedingPost,
  matchForumItems,
  type SourceStatus,
} from '../collectors';
import type { Model } from '../market';
import { forumArchive } from './forum-feeds';
import { mergeListings, reclassifyListings, type ArchivedListing } from './listings';

export const MARKET_OWNER = '__market__';

export type MarketArchive = {
  modelId: string;
  matchingVersion?: number;
  fetchedAt: string;
  partial: boolean;
  listings: ArchivedListing[];
  sources: SourceStatus[];
  threads: { title: string; url: string; date: string; source: string }[];
  note: string;
};

const MATCHING_VERSION = 5;

/** A fresh archive is served for 20 minutes (2 when a source failed transiently). */
const CACHE_MS = 20 * 60_000,
  PARTIAL_CACHE_MS = 2 * 60_000;
/** Even a forced refresh reuses an archive younger than this, so repeated clicks cannot hammer ~40 source requests. */
const MIN_REFRESH_MS = 2 * 60_000;

export function currentArchiveMatches(archive: MarketArchive, model: Model): MarketArchive {
  return archive.matchingVersion === MATCHING_VERSION
    ? archive
    : { ...archive, matchingVersion: MATCHING_VERSION, listings: reclassifyListings(archive.listings, model) };
}

export async function watchMarket(model: Model, owner = MARKET_OWNER, refresh = false): Promise<MarketArchive> {
  const db = getDb(),
    id = `market:${owner}:${model.id}`;
  const previousRow = await db.select().from(records).where(eq(records.id, id)).get();
  const previous = previousRow ? currentArchiveMatches(JSON.parse(previousRow.payload), model) : undefined;
  const age = previous ? Date.now() - +new Date(previous.fetchedAt) : Infinity;
  if (previous && (age < MIN_REFRESH_MS || (!refresh && age < (previous.partial ? PARTIAL_CACHE_MS : CACHE_MS))))
    return previous;
  const lockId = `market-lock:${owner}:${model.id}`,
    lockPayload = JSON.stringify({ expiresAt: Date.now() + 120_000 });
  const lock = await db
    .insert(records)
    .values({ id: lockId, owner, kind: 'market-lock', payload: lockPayload })
    .onConflictDoUpdate({
      target: records.id,
      set: { payload: lockPayload },
      setWhere: sql`json_extract(${records.payload}, '$.expiresAt') < ${Date.now()}`,
    })
    .returning();
  if (!lock.length) {
    if (previous) return previous;
    throw new Error('This watch is being collected. Try again shortly.');
  }
  try {
    const [live, auction, moreAuctions, ...forums] = await Promise.allSettled([
      fetchLiveListings(model, env),
      collectPhillips(model),
      collectAuctionSources(model),
      ...FORUM_FEEDS.map(forumArchive),
    ]);
    const listings = live.status === 'fulfilled' ? live.value.listings : [];
    const sources: SourceStatus[] =
      live.status === 'fulfilled'
        ? live.value.sources
        : [
            {
              id: 'marketplaces',
              name: 'Marketplaces',
              status: 'error',
              count: 0,
              message: 'Marketplace check failed; retained observations are shown.',
            },
          ];
    if (moreAuctions.status === 'fulfilled') {
      listings.push(...moreAuctions.value.listings);
      sources.push(...moreAuctions.value.sources);
    } else
      sources.push({
        id: 'auctions',
        name: 'Additional auctions',
        status: 'error',
        count: 0,
        message: 'Auction checks failed; retained observations are shown.',
      });
    if (auction.status === 'fulfilled') {
      listings.push(...auction.value.listings);
      sources.push(auction.value.source);
    } else
      sources.push({
        id: 'phillips',
        name: 'Phillips auctions',
        status: failureStatus(auction.reason),
        count: 0,
        message: auction.reason instanceof Error ? auction.reason.message : 'Auction results unavailable',
        searchUrl: `https://www.phillips.com/search?${new URLSearchParams({ search: baseReference(model.reference) })}`,
      });
    const threads: MarketArchive['threads'] = [];
    forums.forEach((forum, i) => {
      const feed = FORUM_FEEDS[i],
        searchUrl = feed.url.replace('/index.rss', '/');
      if (forum.status !== 'fulfilled')
        return sources.push({
          id: feed.id,
          name: feed.name,
          status: 'error',
          count: 0,
          message: 'Forum check failed; retained observations are shown.',
          searchUrl,
        });
      const { items, error } = forum.value;
      const matches = matchForumItems(
        items,
        model,
        feed.id,
        'country' in feed ? { country: feed.country, currency: feed.currency } : {},
      );
      listings.push(...matches);
      threads.push(
        ...forumItemsNeedingPost(items, model).map((it) => ({
          title: it.title,
          url: it.url,
          date: it.date,
          source: feed.name,
        })),
      );
      sources.push({
        id: feed.id,
        name: feed.name,
        count: matches.length,
        status: error?.status || 'ok',
        message: error?.message || `Matched ${items.length} archived sale threads.`,
        searchUrl,
      });
    });
    const body: MarketArchive = {
      modelId: model.id,
      matchingVersion: MATCHING_VERSION,
      fetchedAt: new Date().toISOString(), // Persistently blocked sources are reported but do not shorten the cache: only transient failures retry sooner.
      partial: sources.some((s) => s.status === 'error'),
      listings: mergeListings(previous?.listings || [], listings),
      sources,
      threads,
      note: 'Complete-reference matches and same-reference listings that do not state the variant enter the market price; the latter are labelled. Similar models are separate. Missing listings retain their last observed status; disappearance never proves a sale.',
    };
    await db
      .insert(records)
      .values({ id, owner, kind: 'market-history', payload: JSON.stringify(body) })
      .onConflictDoUpdate({ target: records.id, set: { payload: JSON.stringify(body) } });
    return body;
  } finally {
    await db.delete(records).where(and(eq(records.id, lockId), eq(records.payload, lockPayload)));
  }
}
