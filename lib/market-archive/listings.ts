// Specific modules, not the collector package: the watch page bundles this file for the browser.
import type { LiveListing, MatchKind } from '../collectors/core/listing';
import { classifyMatch } from '../collectors/matching/classify';
import { classifyIdentity } from '../collectors/matching/structured';
import type { Model } from '../market';

/** history: shop offers only, one price per day the offer was seen (oldest first), for the new-price graph. */
export type ArchivedListing = LiveListing & { archived?: boolean; firstSeenAt?: string; lastSeenAt?: string; history?: { date: string; price: number }[] };

const MAX_HISTORY = 400;

// Keep old .fi observations under the same key as the corrected marketplace links.
function currentListing(l: ArchivedListing): ArchivedListing {
  if (l.sourceId !== 'kellotux') return l;
  const url = (value: string) => value.replace(/^https:\/\/(?:www\.)?kellotux\.fi\//, 'https://kellotux.com/');
  return { ...l, url: url(l.url), canonicalUrl: l.canonicalUrl && url(l.canonicalUrl) };
}

export function reclassifyListings(listings: ArchivedListing[], model: Model): ArchivedListing[] {
  // Manually assigned listings and others that no longer match any rule stay visible as similar, never priced.
  return listings.map((l) => ({ ...l, match: (l.identity ? classifyIdentity(l.title, model, l.identity, l.matchDetails) : classifyMatch(l.title, model, l.matchDetails)) ?? 'similar' }));
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
  previous = previous.map(currentListing);
  incoming = incoming.map(currentListing);
  const listings = new Map(previous.map((l) => [l.canonicalUrl || l.url, { ...l, archived: true }]));
  for (const l of incoming) {
    const key = l.canonicalUrl || l.url, old = listings.get(key);
    listings.set(key, { ...l, archived: false, firstSeenAt: old?.firstSeenAt || now, lastSeenAt: now });
  }
  return [...listings.values()];
}
