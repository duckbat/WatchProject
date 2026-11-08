// Specific modules, not the collector package: the watch page bundles this file for the browser.
import type { LiveListing, MatchKind } from '../collectors/core/listing';
import { classifyMatch } from '../collectors/matching/classify';
import { classifyIdentity } from '../collectors/matching/structured';
import type { Model } from '../market';

export type ArchivedListing = LiveListing & { archived?: boolean; firstSeenAt?: string; lastSeenAt?: string };

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

/** Absence from a search never establishes that a watch sold. */
export function mergeListings(
  previous: ArchivedListing[],
  incoming: LiveListing[],
  now = new Date().toISOString(),
): ArchivedListing[] {
  const listings = new Map(previous.map((l) => [l.canonicalUrl || l.url, { ...l, archived: true }]));
  for (const l of incoming) {
    const key = l.canonicalUrl || l.url, old = listings.get(key);
    listings.set(key, { ...l, archived: false, firstSeenAt: old?.firstSeenAt || now, lastSeenAt: now });
  }
  return [...listings.values()];
}
