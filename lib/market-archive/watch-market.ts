import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { env, waitUntil } from 'cloudflare:workers';
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
import { mergeListings, mergeOffers, reclassifyListings, type ArchivedListing } from './listings';
import {
  archiveId,
  assembleRows,
  isStorageV2,
  listingPrefix,
  metaId,
  offerPrefix,
  planArchiveWrites,
  prefixEnd,
  rowKind,
  type ArchiveMeta,
  type MarketArchive,
  type StoredRow,
} from './storage';
import { summarizeMarkets, type PricedRow } from './summary';
import { getFx } from '../fx';
import { collectShops } from '../collectors/services/shops';
import { collectEbayNewOffers, type EbayUsage } from '../collectors/services/ebay';
import type { CollectorSecrets } from '../collectors/live';
import { addEbayCalls, ebayBlocked, ebayDay, ebayLimits } from './ebay-budget';

export const MARKET_OWNER = '__market__';
export type { MarketArchive } from './storage';

export type CollectOptions = {
  /** false: leave eBay out of this run (background refreshes spend eBay calls on popular Rolexes only). */
  ebay?: boolean;
  /** Counts eBay calls against the background share of the daily budget. */
  background?: boolean;
  /** Serve an archive up to STALE_MS old at once and collect a newer one in the background. */
  revalidateInBackground?: boolean;
};

const MATCHING_VERSION = 8;
const COLLECTOR_VERSION = 2;

/** A fresh archive is served for 20 minutes (2 when a source failed transiently). */
const CACHE_MS = 20 * 60_000,
  PARTIAL_CACHE_MS = 2 * 60_000;
/** Even a forced refresh reuses an archive younger than this, so repeated clicks cannot hammer ~40 source requests. */
const MIN_REFRESH_MS = 2 * 60_000;
/** Watch pages show an archive up to a day old immediately while it is refreshed (the scheduled refresh keeps most younger). */
const STALE_MS = 24 * 3_600_000;
const RESERVED_FOR_POPULAR = 'Not checked in this background update: background eBay calls are kept for the most popular Rolexes. Listings from the last check are shown.';

export function currentArchiveMatches(archive: MarketArchive, model: Model): MarketArchive {
  return archive.matchingVersion === MATCHING_VERSION
    ? archive
    : { ...archive, matchingVersion: MATCHING_VERSION, listings: reclassifyListings(archive.listings, model), retailOffers: reclassifyListings(archive.retailOffers || [], model) };
}

type Db = ReturnType<typeof getDb>;
type StoredMeta = ArchiveMeta | MarketArchive;

/** All rows under one id prefix (an index range scan on the primary key), optionally of some kinds only. */
async function rowsWithPrefix(db: Db, prefix: string, kinds?: string[]): Promise<StoredRow[]> {
  const range = and(gte(records.id, prefix), lt(records.id, prefixEnd(prefix)));
  return db
    .select({ id: records.id, kind: records.kind, payload: records.payload })
    .from(records)
    .where(kinds ? and(range, inArray(records.kind, kinds)) : range);
}

function archiveFromMeta(meta: ArchiveMeta, listings: ArchivedListing[], retailOffers: ArchivedListing[]): MarketArchive {
  const rest: Partial<ArchiveMeta> = { ...meta };
  delete rest.storage;
  delete rest.live;
  delete rest.liveOffers;
  return { ...(rest as Omit<ArchiveMeta, 'storage' | 'live' | 'liveOffers'>), listings, retailOffers };
}

/** What the watch page gets: this reference's listings and offers. Other models: see similarListings. */
async function pageArchive(db: Db, owner: string, model: Model, meta: StoredMeta): Promise<MarketArchive> {
  if (!isStorageV2(meta)) {
    // Not yet rewritten as rows (version 1): send the same subset; the next refresh converts it.
    const listings = meta.listings.filter((l) => rowKind(l, model) === 'market-listing');
    return { ...meta, listings, otherSimilar: meta.listings.length - listings.length };
  }
  const aid = archiveId(owner, model.id);
  const [listings, offers] = await Promise.all([rowsWithPrefix(db, listingPrefix(aid), ['market-listing']), rowsWithPrefix(db, offerPrefix(aid))]);
  return archiveFromMeta(meta, assembleRows(listings, meta.live, meta.fetchedAt), assembleRows(offers, meta.liveOffers, meta.fetchedAt));
}

/** Every stored listing and offer (for merging a new collection), with the rows as stored. */
async function fullArchive(db: Db, owner: string, model: Model, meta: StoredMeta) {
  if (!isStorageV2(meta)) return { archive: meta, rows: new Map<string, StoredRow>() };
  const aid = archiveId(owner, model.id);
  const [listings, offers] = await Promise.all([rowsWithPrefix(db, listingPrefix(aid)), rowsWithPrefix(db, offerPrefix(aid))]);
  return {
    archive: archiveFromMeta(meta, assembleRows(listings, meta.live, meta.fetchedAt), assembleRows(offers, meta.liveOffers, meta.fetchedAt)),
    rows: new Map([...listings, ...offers].map((r) => [r.id, r])),
  };
}

async function readMeta(db: Db, owner: string, modelId: string): Promise<StoredMeta | undefined> {
  const row = await db.select({ payload: records.payload }).from(records).where(eq(records.id, metaId(owner, modelId))).get();
  return row ? (JSON.parse(row.payload) as StoredMeta) : undefined;
}

/** The stored archive as the watch page sees it, without collecting (undefined if never collected). */
export async function readMarketArchive(model: Model, owner = MARKET_OWNER): Promise<MarketArchive | undefined> {
  const db = getDb(), meta = await readMeta(db, owner, model.id);
  return meta && currentArchiveMatches(await pageArchive(db, owner, model, meta), model);
}

/** Other models stored for this watch ("Show similar listings"), never priced. */
export async function similarListings(model: Model, owner = MARKET_OWNER): Promise<ArchivedListing[]> {
  const db = getDb(), meta = await readMeta(db, owner, model.id);
  if (!meta) return [];
  const listings = isStorageV2(meta)
    ? assembleRows(await rowsWithPrefix(db, listingPrefix(archiveId(owner, model.id)), ['market-similar']), meta.live, meta.fetchedAt)
    : meta.listings;
  const current = meta.matchingVersion === MATCHING_VERSION ? listings : reclassifyListings(listings, model);
  return current.filter((l) => rowKind(l, model) === 'market-similar');
}

const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/**
 * Writes a merged archive as rows: changed listing/offer rows first (D1 batches), the archive row last, so a reader
 * never sees an archive row that names listings not yet written. Catalog watches also get their search summary.
 */
async function saveArchive(db: Db, owner: string, model: Model, archive: MarketArchive, previousRows: Map<string, StoredRow>): Promise<MarketArchive> {
  const writes = planArchiveWrites(owner, model, archive, previousRows);
  const statements = [
    ...writes.upserts.map((r) =>
      db.insert(records).values({ id: r.id, owner, kind: r.kind, payload: r.payload }).onConflictDoUpdate({ target: records.id, set: { kind: r.kind, payload: r.payload } }),
    ),
    ...chunks(writes.deletes, 50).map((ids) => db.delete(records).where(and(eq(records.owner, owner), inArray(records.id, ids)))),
  ];
  for (const batch of chunks(statements, 50)) await db.batch(batch as [(typeof batch)[number], ...(typeof batch)[number][]]);
  const meta = JSON.stringify(writes.meta);
  await db
    .insert(records)
    .values({ id: metaId(owner, model.id), owner, kind: 'market-history', payload: meta })
    .onConflictDoUpdate({ target: records.id, set: { payload: meta } });
  if (owner === MARKET_OWNER) await saveSummary(db, model, writes.listings).catch(() => undefined);
  return { ...archive, listings: writes.listings, otherSimilar: writes.meta.otherSimilar };
}

/** The card/search market price of a catalog watch, computed when it is collected instead of on every search. */
async function saveSummary(db: Db, model: Model, listings: ArchivedListing[]) {
  const rows: PricedRow[] = listings.map((l) => ({ modelId: model.id, price: l.price, currency: l.currency, status: l.status, match: l.match, sourceId: l.sourceId, observedAt: l.observedAt, listedAt: l.listedAt ?? null, title: l.title }));
  const summary = summarizeMarkets(rows, (await getFx())?.fx ?? null).get(model.id);
  if (!summary) return;
  const payload = JSON.stringify({ modelId: model.id, ...summary });
  await db
    .insert(records)
    .values({ id: `market-summary:${model.id}`, owner: MARKET_OWNER, kind: 'market-summary', payload })
    .onConflictDoUpdate({ target: records.id, set: { payload } });
}

export async function watchMarket(model: Model, owner = MARKET_OWNER, refresh = false, opts: CollectOptions = {}): Promise<MarketArchive> {
  const db = getDb();
  const meta = await readMeta(db, owner, model.id);
  const age = meta ? Date.now() - +new Date(meta.fetchedAt) : Infinity;
  const current = meta?.collectorVersion === COLLECTOR_VERSION;
  const page = async () => currentArchiveMatches(await pageArchive(db, owner, model, meta!), model);
  // A matching change moves listings between this reference and "other models", which only a collection rewrites.
  if (meta && current && (age < MIN_REFRESH_MS || (!refresh && meta.matchingVersion === MATCHING_VERSION && age < (meta.partial ? PARTIAL_CACHE_MS : CACHE_MS))))
    return page();
  if (meta && current && !refresh && opts.revalidateInBackground && age < STALE_MS) {
    waitUntil(watchMarket(model, owner, true, { ...opts, revalidateInBackground: false }).catch(() => undefined));
    return { ...(await page()), refreshing: true };
  }
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
    if (meta) return page();
    throw new Error('This watch is being collected. Try again shortly.');
  }
  try {
    const stored = meta ? await fullArchive(db, owner, model, meta) : undefined;
    const previous = stored ? currentArchiveMatches(stored.archive, model) : undefined;
    // eBay is the one source with a daily call limit: check today's count first and count this run's calls.
    let ebaySkip = opts.ebay === false ? RESERVED_FOR_POPULAR : null;
    if (!ebaySkip)
      try {
        ebaySkip = ebayBlocked(await ebayDay(), ebayLimits(env), Boolean(opts.background));
      } catch {
        // Without the count, collect as before rather than lose eBay.
      }
    const usage: EbayUsage = { calls: 0 };
    const secrets: CollectorSecrets = Object.assign(Object.create(env), { ebayUsage: usage });
    const [live, auction, moreAuctions, shops, newOffers, ...forums] = await Promise.allSettled([
      fetchLiveListings(model, secrets, undefined, { ebay: !ebaySkip }),
      collectPhillips(model),
      collectAuctionSources(model),
      collectShops(model),
      ebaySkip ? Promise.resolve({ listings: [], sources: [] }) : collectEbayNewOffers(model, secrets),
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
    if (shops.status === 'fulfilled') {
      listings.push(...shops.value.listings);
      sources.push(...shops.value.sources);
    } else sources.push({ id: 'shops', name: 'Watch shops', status: 'error', count: 0, message: 'Shop prices unavailable; previous observations retained.' });
    if (newOffers.status === 'fulfilled') sources.push(...newOffers.value.sources);
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
    await addEbayCalls(usage.calls, Boolean(opts.background)).catch(() => undefined);
    // A skipped eBay check keeps the previous eBay chips and leaves eBay listings as they were (not "gone").
    if (ebaySkip) sources.push(...(previous?.sources || []).filter((s) => s.id.startsWith('ebay')).map((s) => ({ ...s, message: ebaySkip })));
    const wasArchived = new Map([...(previous?.listings || []), ...(previous?.retailOffers || [])].map((l) => [l.url, l.archived]));
    const unchecked = (l: ArchivedListing) => (ebaySkip && l.sourceId.startsWith('ebay') ? { ...l, archived: wasArchived.get(l.url) ?? l.archived } : l);
    const body: MarketArchive = {
      modelId: model.id,
      matchingVersion: MATCHING_VERSION,
      collectorVersion: COLLECTOR_VERSION,
      fetchedAt: new Date().toISOString(), // Persistently blocked sources are reported but do not shorten the cache: only transient failures retry sooner.
      partial: sources.some((s) => s.status === 'error'),
      listings: mergeListings(previous?.listings || [], listings).map(unchecked),
      retailOffers: mergeOffers(previous?.retailOffers || [], [...(shops.status === 'fulfilled' ? shops.value.retailOffers : []), ...(newOffers.status === 'fulfilled' ? newOffers.value.listings : [])]).map(unchecked),
      sources,
      threads,
      note: 'Complete-reference matches and same-reference listings that do not state the variant enter the market price; the latter are labelled. Similar models are separate. Missing listings retain their last observed status; disappearance never proves a sale.',
    };
    return await saveArchive(db, owner, model, body, stored?.rows ?? new Map());
  } finally {
    await db.delete(records).where(and(eq(records.id, lockId), eq(records.payload, lockPayload)));
  }
}
