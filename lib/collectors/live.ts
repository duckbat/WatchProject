import type { Model } from '../market';
import type { LiveListing } from './core/listing';
import { addListings, type CollectorResult } from './core/result';
import { searchQueries } from './matching/reference';
import { chrono24Source } from './services/chrono24';
import { collectEbay, type EbaySecrets } from './services/ebay';
import { collectRecommerce } from './services/recommerce';
import { collectReddit, type RedditSecrets } from './services/reddit';
import { collectWatchRecon } from './services/watchrecon';
import { collectKellotux } from './services/kellotux';
import { collectHuuto } from './services/huuto';

export type CollectorSecrets = EbaySecrets & RedditSecrets & { EBAY_MARKETPLACE?: string };

/**
 * Live, unsaved asking prices for the detail page: exact and base-reference matches plus clearly labelled similar
 * listings. Marketplaces run in parallel; results merge in a fixed order so the source chips keep their order.
 * Auctions and forum feeds are collected separately (lib/market-archive/watch-market.ts) because they are archived differently.
 */
export async function fetchLiveListings(
  model: Model & { family?: string },
  secrets: CollectorSecrets,
  marketplace = secrets.EBAY_MARKETPLACE || 'EBAY_DE',
): Promise<CollectorResult> {
  const queries = searchQueries(model);
  const results = await Promise.all([
    collectRecommerce(model, queries),
    collectEbay(model, secrets, marketplace),
    collectReddit(model, queries, secrets),
    collectWatchRecon(model, queries[0]),
    collectKellotux(model),
    collectHuuto(model),
    chrono24Source(queries[0]),
  ]);
  const listings: LiveListing[] = [];
  for (const result of results) addListings(listings, result.listings);
  return { listings, sources: results.flatMap((r) => r.sources) };
}
