import type { CollectorResult } from '../core/result';

/** Chrono24 has no public API and challenges automated requests. It is linked, never fetched. */
export function chrono24Source(query: string): CollectorResult {
  return {
    listings: [],
    sources: [
      {
        id: 'chrono24',
        name: 'Chrono24',
        status: 'blocked',
        count: 0,
        message: 'Chrono24 blocks automated access. Open its search and record prices you see.',
        searchUrl: `https://www.chrono24.com/search/index.htm?${new URLSearchParams({ query })}`,
      },
    ],
  };
}
