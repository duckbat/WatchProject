// How a watch's market archive is stored in D1 (storage version 2). Pure functions: watch-market.ts does the I/O.
//
// Version 1 kept every listing inside the archive row. With eBay's volume that row grows towards D1's 2 MB row limit,
// and every page view loaded all of it, although ~70% were other models shown only on request. Version 2 keeps:
//   market-history  `market:<owner>:<modelId>`        metadata, source chips, which listings are live
//   market-listing  `ml:<owner>:<modelId>:<key>`       a listing of this reference (priced, or another dial)
//   market-similar  `ml:<owner>:<modelId>:<key>`       another model, loaded only for "Show similar listings"
//   market-offer    `mo:<owner>:<modelId>:<key>`       a new-watch shop/dealer offer with its daily price history
// Nothing is deleted: a listing row stays when the listing disappears (archived) and keeps its earlier prices.
import type { Model } from '../market';
import type { SourceStatus } from '../collectors/core/result';
import { namesBaseReference, type ArchivedListing } from './listings';

export const STORAGE_VERSION = 2;

export type MarketArchive = {
  modelId: string;
  matchingVersion?: number;
  collectorVersion?: number;
  fetchedAt: string;
  partial: boolean;
  /** Version 2 reads: this reference's listings only (see otherSimilar). Version 1 rows: every listing. */
  listings: ArchivedListing[];
  retailOffers?: ArchivedListing[];
  sources: SourceStatus[];
  threads: { title: string; url: string; date: string; source: string }[];
  note: string;
  /** Other-model listings stored for this watch, fetched separately ("Show similar listings"). */
  otherSimilar?: number;
  /** Served from the archive while a newer collection runs in the background; ask again shortly. */
  refreshing?: boolean;
};

/** The market-history row of version 2. live/liveOffers: key → observedAt of every listing/offer the last collection returned. */
export type ArchiveMeta = Omit<MarketArchive, 'listings' | 'retailOffers' | 'refreshing'> & {
  storage: typeof STORAGE_VERSION;
  live: Record<string, string>;
  liveOffers: Record<string, string>;
  otherSimilar: number;
};

export type RowKind = 'market-listing' | 'market-similar' | 'market-offer';
export type StoredRow = { id: string; kind: string; payload: string };

export const archiveId = (owner: string, modelId: string) => `${owner}:${modelId}`;
export const metaId = (owner: string, modelId: string) => `market:${owner}:${modelId}`;
export const listingPrefix = (aid: string) => `ml:${aid}:`;
export const offerPrefix = (aid: string) => `mo:${aid}:`;
/** Upper bound for an id range scan over one prefix (ids are ASCII; U+FFFF sorts after them). */
export const prefixEnd = (prefix: string) => `${prefix}￿`;

export const listingKey = (l: Pick<ArchivedListing, 'canonicalUrl' | 'url'>) => l.canonicalUrl || l.url;

export const isStorageV2 = (meta: unknown): meta is ArchiveMeta => (meta as ArchiveMeta | null)?.storage === STORAGE_VERSION;

export function rowKind(l: ArchivedListing, model: Model): RowKind {
  return namesBaseReference(l, model) ? 'market-listing' : 'market-similar';
}

/**
 * The stored form of a listing. A live listing's collection-time fields come from the archive row (the last
 * collection), so a listing seen again unchanged is not rewritten on every refresh.
 */
function storedForm(l: ArchivedListing, live: boolean): ArchivedListing {
  if (!live) return { ...l, archived: true };
  const rest: Partial<ArchivedListing> = { ...l };
  delete rest.archived;
  delete rest.lastSeenAt;
  delete rest.observedAt;
  delete rest.collectedAt;
  return rest as ArchivedListing;
}

/** Rebuilds listings from their rows: live ones take the last collection's time and their observedAt. */
export function assembleRows(rows: Pick<StoredRow, 'payload'>[], live: Record<string, string>, fetchedAt: string): ArchivedListing[] {
  return rows.map((row) => {
    const l = JSON.parse(row.payload) as ArchivedListing;
    const observedAt = live[listingKey(l)];
    return observedAt === undefined
      ? { ...l, archived: true }
      : { ...l, archived: false, lastSeenAt: fetchedAt, observedAt, collectedAt: fetchedAt };
  });
}

export type ArchiveWrites = { meta: ArchiveMeta; upserts: StoredRow[]; deletes: string[]; listings: ArchivedListing[] };

/**
 * The rows to write for a freshly merged archive: new listings, changed ones, listings that went live or archived,
 * and listings that moved between this reference and "other models" after a matching change. Previous rows whose key
 * no longer exists (a listing re-keyed by a URL migration) are deleted; their data lives on under the new key.
 * `listings` is what the watch page receives: this reference's listings, without other models.
 */
export function planArchiveWrites(
  owner: string,
  model: Model,
  archive: MarketArchive,
  previousRows: Map<string, { kind: string; payload: string }>,
): ArchiveWrites {
  const aid = archiveId(owner, model.id);
  const live: Record<string, string> = {}, liveOffers: Record<string, string> = {};
  const upserts: StoredRow[] = [], keep = new Set<string>(), page: ArchivedListing[] = [];
  let otherSimilar = 0;
  const put = (id: string, kind: RowKind, l: ArchivedListing, isLive: boolean) => {
    keep.add(id);
    const payload = JSON.stringify(storedForm(l, isLive));
    const before = previousRows.get(id);
    if (!before || before.kind !== kind || before.payload !== payload) upserts.push({ id, kind, payload });
  };
  for (const l of archive.listings) {
    const key = listingKey(l), kind = rowKind(l, model), isLive = !l.archived;
    if (isLive) live[key] = l.observedAt;
    if (kind === 'market-similar') otherSimilar++;
    else page.push(l);
    put(listingPrefix(aid) + key, kind, l, isLive);
  }
  for (const o of archive.retailOffers || []) {
    const key = listingKey(o), isLive = !o.archived;
    if (isLive) liveOffers[key] = o.observedAt;
    put(offerPrefix(aid) + key, 'market-offer', o, isLive);
  }
  const deletes = [...previousRows.keys()].filter((id) => !keep.has(id));
  const rest: Partial<MarketArchive> = { ...archive };
  delete rest.listings;
  delete rest.retailOffers;
  delete rest.refreshing;
  const meta = { ...(rest as Omit<MarketArchive, 'listings' | 'retailOffers' | 'refreshing'>), storage: STORAGE_VERSION, live, liveOffers, otherSimilar } as ArchiveMeta;
  return { meta, upserts, deletes, listings: page };
}
