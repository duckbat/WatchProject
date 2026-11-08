import type { LiveListing } from './collectors';

export type ArchivedListing = LiveListing & { archived?: boolean; firstSeenAt?: string; lastSeenAt?: string };

export function listingKind(l: { match: 'exact' | 'similar'; status: string; archived?: boolean }): 'similar' | 'confirmed-sale' | 'sold-asking' | 'asking' | 'live' {
  return l.match === 'similar' ? 'similar' : l.status === 'confirmed-sale' ? 'confirmed-sale' : l.status === 'sold-asking' ? 'sold-asking' : l.archived ? 'asking' : 'live';
}

/** Absence from a search never establishes that a watch sold. */
export function mergeListings(previous: ArchivedListing[], incoming: LiveListing[], now = new Date().toISOString()): ArchivedListing[] {
  const listings = new Map(previous.map((l) => [l.url, { ...l, archived: true }]));
  for (const l of incoming) {
    const old = listings.get(l.url);
    listings.set(l.url, { ...l, archived: false, firstSeenAt: old?.firstSeenAt || now, lastSeenAt: now });
  }
  return [...listings.values()];
}
