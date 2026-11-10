// Specific modules, not the collector package: the watch page bundles this file for the browser.
import { ebayItemKey } from '../collectors/core/ebay-item';
import type { LiveListing, MatchKind } from '../collectors/core/listing';
import { classifyMatch, exactMatch } from '../collectors/matching/classify';
import { baseReference } from '../collectors/matching/reference';
import { classifyIdentity } from '../collectors/matching/structured';
import { defaultSources, type Model } from '../market';

/** history: shop offers only, one price per day the offer was seen (oldest first), for the new-price graph. */
/**
 * priceChanges: a listing's earlier asking prices, oldest first, each with the last day it was seen at that price.
 * The current price stays in `price`; nothing observed is overwritten.
 */
export type ArchivedListing = LiveListing & { archived?: boolean; firstSeenAt?: string; lastSeenAt?: string; history?: { date: string; price: number }[]; priceChanges?: { date: string; price: number }[] };

const MAX_HISTORY = 400;
const MAX_PRICE_CHANGES = 50;

// Keep old .fi observations under the same key as the corrected marketplace links, and old eBay listings under their item key.
function currentListing(l: ArchivedListing): ArchivedListing {
  if (l.sourceId.startsWith('ebay') && !l.canonicalUrl) return { ...l, canonicalUrl: ebayItemKey(l.url) };
  if (l.sourceId !== 'kellotux') return l;
  const url = (value: string) => value.replace(/^https:\/\/(?:www\.)?kellotux\.fi\//, 'https://kellotux.com/');
  return { ...l, url: url(l.url), canonicalUrl: l.canonicalUrl && url(l.canonicalUrl) };
}

/** A listing that does not state where the seller is takes its source's home country (Laatukellot, Kellotux: FI). */
const homeCountry = new Map(defaultSources.filter((s) => s.country).map((s) => [s.id, s.country]));
function withCountry(l: ArchivedListing): ArchivedListing {
  return l.country === 'UNKNOWN' && homeCountry.has(l.sourceId) ? { ...l, country: homeCountry.get(l.sourceId)! } : l;
}

export function reclassifyListings(listings: ArchivedListing[], model: Model): ArchivedListing[] {
  // Manually assigned listings and others that no longer match any rule stay visible as similar, never priced.
  return listings.map((l) => withCountry({ ...l, match: (l.identity ? classifyIdentity(l.title, model, l.identity, l.matchDetails) : classifyMatch(l.title, model, l.matchDetails)) ?? 'similar' }));
}

/**
 * Whether a listing belongs to the watch's reference (any dial): priced matches, and "similar" listings that name the
 * base reference (another dial). The "All dials" price counts these; other models are only shown on request.
 */
export function namesBaseReference(l: Pick<ArchivedListing, 'match' | 'title' | 'identity' | 'matchDetails'>, model: Model) {
  if (l.match !== 'similar') return true;
  const base = baseReference(model.reference);
  return l.identity
    ? ['exact', 'reference'].includes(classifyIdentity(l.title, { ...model, reference: base, name: model.name.split('/')[0] }, l.identity, l.matchDetails) || '')
    : exactMatch(l.title, { brand: model.brand, reference: base }, l.matchDetails);
}

export function listingKind(l: {
  match: MatchKind;
  status: string;
  archived?: boolean;
}): 'similar' | 'confirmed-sale' | 'sold-asking' | 'asking' | 'live' {
  return l.match === 'similar'
    ? 'similar'
    : l.status === 'confirmed-sale'
      ? 'confirmed-sale'
      : l.status === 'sold-asking'
        ? 'sold-asking'
        : l.archived
          ? 'asking'
          : 'live';
}

/**
 * Shop offers merged like listings, plus a daily price history: a shop changing its price is new-price movement,
 * not a new offer. Offers no longer returned keep their history and are marked archived.
 */
export function mergeOffers(previous: ArchivedListing[], incoming: LiveListing[], now = new Date().toISOString()): ArchivedListing[] {
  const today = now.slice(0, 10);
  const before = new Map(previous.map((l) => [l.canonicalUrl || l.url, l]));
  return mergeListings(previous, incoming, now).map((l) => {
    if (l.archived) return l;
    const old = before.get(l.canonicalUrl || l.url);
    // Offers archived before history existed start from their last observed price.
    const history = old?.history ? [...old.history] : old ? [{ date: old.observedAt, price: old.price }] : [];
    if (history.at(-1)?.date === today) history[history.length - 1] = { date: today, price: l.price };
    else history.push({ date: today, price: l.price });
    return { ...l, history: history.slice(-MAX_HISTORY) };
  });
}

/** Absence from a search never establishes that a watch sold. */
export function mergeListings(
  previous: ArchivedListing[],
  incoming: LiveListing[],
  now = new Date().toISOString(),
): ArchivedListing[] {
  previous = previous.map(currentListing).map(withCountry);
  incoming = incoming.map(currentListing).map(withCountry);
  const listings = new Map(previous.map((l) => [l.canonicalUrl || l.url, { ...l, archived: true }]));
  for (const l of incoming) {
    const key = l.canonicalUrl || l.url, old = listings.get(key);
    // A recorded sale is kept when the same item still shows as an asking listing (multi-quantity eBay listings).
    if (old && old.status !== 'asking' && l.status === 'asking') listings.set(key, { ...old, lastSeenAt: now });
    else {
      // A new price is added to the listing; the previous one is kept with the last day it was seen.
      const repriced = old && old.currency === l.currency && old.price !== l.price;
      const priceChanges = repriced
        ? [...(old.priceChanges || []), { date: (old.lastSeenAt || old.observedAt).slice(0, 10), price: old.price }].slice(-MAX_PRICE_CHANGES)
        : old?.priceChanges;
      listings.set(key, { ...l, archived: false, firstSeenAt: old?.firstSeenAt || now, lastSeenAt: now, ...(priceChanges ? { priceChanges } : {}) });
    }
  }
  return [...listings.values()];
}
