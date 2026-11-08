import type { Model } from '../../../market';
import { failureStatus } from '../../core/errors';
import type { LiveListing } from '../../core/listing';
import { errorMessage, type SourceStatus } from '../../core/result';
import { antiquorum } from './antiquorum';
import { auctionet } from './auctionet';
import { christies } from './christies';
import type { AuctionHouse } from './shared';

/** Auction houses with public results, in the order their source chips appear. Phillips runs separately (lot pages). */
export const AUCTION_HOUSES: AuctionHouse[] = [auctionet, antiquorum, christies];

/** Runs every house independently: one blocked or changed site never hides the others' results. */
export async function collectAuctionSources(
  model: Model & { family?: string },
  fetcher: typeof fetch = fetch,
  now = new Date(),
) {
  const results = await Promise.all(
    AUCTION_HOUSES.map(async (house) => {
      const source = { id: house.id, name: house.name, searchUrl: house.searchUrl(model) };
      try {
        const { listings, message, failed } = await house.run(model, fetcher, now);
        return {
          listings,
          source: { ...source, status: failed ? 'error' : 'ok', count: listings.length, message } as SourceStatus,
        };
      } catch (e) {
        return {
          listings: [] as LiveListing[],
          source: {
            ...source,
            status: failureStatus(e),
            count: 0,
            message: errorMessage(e, 'Auction source unavailable'),
          } as SourceStatus,
        };
      }
    }),
  );
  return { listings: results.flatMap((r) => r.listings), sources: results.map((r) => r.source) };
}
