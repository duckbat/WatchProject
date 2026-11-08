import type { LiveListing, MatchKind } from './listing';

/** One source's outcome, shown as a chip on the watch page. */
export type SourceStatus = {
  id: string;
  name: string;
  status: 'ok' | 'error' | 'credentials_required' | 'blocked';
  count: number;
  message?: string;
  searchUrl?: string;
};

/** What every collector service returns. Services report failures as sources; they never throw. */
export type CollectorResult = { listings: LiveListing[]; sources: SourceStatus[] };

const matchRank: Record<MatchKind, number> = { exact: 0, reference: 1, similar: 2 };

/** Adds listings by URL; a URL seen twice keeps its strongest match. Returns how many URLs were new. */
export function addListings(into: LiveListing[], items: LiveListing[]) {
  const index = new Map(into.map((l, i) => [l.url, i]));
  let added = 0;
  for (const item of items) {
    const i = index.get(item.url);
    if (i === undefined) {
      index.set(item.url, into.push(item) - 1);
      added++;
    } else if (matchRank[item.match] < matchRank[into[i].match]) into[i] = item;
  }
  return added;
}

/** Complete-reference matches as plain price candidates (the on-demand collection endpoint saves only these). */
export const exactCandidates = (listings: LiveListing[]) =>
  listings.filter((l) => l.match === 'exact').map(({ match: _match, image: _image, ...candidate }) => candidate);

export const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
