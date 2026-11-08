import type { Model } from '../market';
import { CollectorError } from './core/errors';
import { exactCandidates } from './core/result';
import { baseReference } from './matching/reference';
import { searchEbay } from './services/ebay';
import { recommerceSearch } from './services/recommerce';

const unsupported: Record<string, string> = {
  facebook:
    'Facebook group collection is not connected. Private group content requires a supported authorized data source.',
  chrono24: 'Chrono24 blocked the public collection check. No bypass is configured.',
  reddit: 'Reddit collection needs an approved API integration; it is not configured.',
};

/** On-demand collection for one provider (POST /api/market/collect): complete-reference matches only, ready to save. */
export async function collectPrices(
  provider: string,
  model: Model,
  secrets: { EBAY_CLIENT_ID?: string; EBAY_CLIENT_SECRET?: string },
  marketplace = 'EBAY_DE',
) {
  if (provider === 'tori')
    return exactCandidates(await recommerceSearch('tori', `${model.brand} ${baseReference(model.reference)}`, model));
  if (provider === 'ebay') {
    if (!secrets.EBAY_CLIENT_ID || !secrets.EBAY_CLIENT_SECRET)
      throw new CollectorError(
        'credentials_required',
        'eBay needs EBAY_CLIENT_ID and EBAY_CLIENT_SECRET configured on the server.',
      );
    return exactCandidates(
      await searchEbay(model, {
        host: 'api.ebay.com',
        id: secrets.EBAY_CLIENT_ID,
        secret: secrets.EBAY_CLIENT_SECRET,
        marketplace,
      }),
    );
  }
  throw new CollectorError(
    'unsupported_source',
    unsupported[provider] || 'Automatic collection is not available for this source.',
  );
}
