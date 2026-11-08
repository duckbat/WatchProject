import type { Model } from '../../../market';
import type { LiveListing } from '../../core/listing';
import { failureStatus } from '../../core/errors';
import { errorMessage, type SourceStatus } from '../../core/result';
import { laatukellot } from './laatukellot';
import { keskisenkello } from './keskisenkello';

export async function collectShops(model: Model, fetcher: typeof fetch = fetch, now = new Date()) {
  const results = await Promise.all([laatukellot, keskisenkello].map(async shop => {
    const source = { id: shop.id, name: shop.name, searchUrl: shop.searchUrl(model) };
    try {
      const result = await shop.run(model, fetcher, now);
      return { ...result, source: { ...source, status: 'ok', count: result.listings.length + result.retailOffers.length, message: 'Current shop selling prices, not official MSRP. New-watch offers stay separate from used-market prices. Unavailable products and units-sold counters are not sold deals.' } as SourceStatus };
    } catch (e) { return { listings: [] as LiveListing[], retailOffers: [] as LiveListing[], source: { ...source, status: failureStatus(e), count: 0, message: errorMessage(e, 'Shop search unavailable') } as SourceStatus }; }
  }));
  return { listings: results.flatMap(r => r.listings), retailOffers: results.flatMap(r => r.retailOffers), sources: results.map(r => r.source) };
}
