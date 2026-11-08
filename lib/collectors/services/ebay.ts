import { countries, type Model } from '../../market';
import { CollectorError, failureStatus } from '../core/errors';
import { safeFetch } from '../core/http';
import { type Candidate, collectedPrice, firstImage, type LiveListing } from '../core/listing';
import { type CollectorResult, errorMessage, exactCandidates } from '../core/result';
import { baseReference } from '../matching/reference';
import { classifyMatch } from '../matching/classify';

/** The parts of a Browse API item_summary/search response that are read. */
type EbayItem = {
  title?: string;
  itemWebUrl?: string;
  itemLocation?: { country?: string };
  price?: { value?: string; currency?: string };
  conditionId?: string;
  seller?: { sellerAccountType?: string };
  image?: { imageUrl?: string };
  thumbnailImages?: unknown;
  itemCreationDate?: string;
};
export type EbaySearchResponse = { itemSummaries?: EbayItem[]; errors?: unknown[] };

export function parseEbay(body: EbaySearchResponse, model: Model, now = new Date()): Candidate[] {
  return exactCandidates(parseEbayListings(body, model, now));
}

export function parseEbayListings(
  body: EbaySearchResponse,
  model: Model & { family?: string },
  now = new Date(),
): LiveListing[] {
  const result: LiveListing[] = [];
  for (const p of (body?.itemSummaries || []).slice(0, 50)) {
    const match = classifyMatch(p.title || '', model);
    if (!match) continue;
    let link: URL;
    try {
      link = new URL(p.itemWebUrl ?? '');
    } catch {
      continue;
    }
    if (link.protocol !== 'https:' || !/(^|\.)ebay\.(com|de|co\.uk|fr|it|es|com\.hk|com\.sg)$/.test(link.hostname)) continue;
    const location = p.itemLocation?.country;
    const c = collectedPrice.safeParse({
      modelId: model.id,
      sourceId: 'ebay',
      country: location && location in countries ? location : 'UNKNOWN',
      currency: p.price?.currency,
      price: Number(p.price?.value),
      status: 'asking',
      observedAt: now.toISOString().slice(0, 10),
      condition: p.conditionId === '1000' ? 'new' : Number(p.conditionId) >= 3000 ? 'used' : 'unknown',
      sellerType:
        p.seller?.sellerAccountType === 'BUSINESS'
          ? 'dealer'
          : p.seller?.sellerAccountType === 'INDIVIDUAL'
            ? 'private'
            : 'unknown',
      contents: 'unknown',
      url: link.origin + link.pathname,
      title: p.title,
      collectedAt: now.toISOString(),
    });
    if (c.success && !result.some((r) => r.url === c.data.url))
      result.push({
        ...c.data,
        match,
        image: firstImage(p.image?.imageUrl || p.thumbnailImages),
        listedAt: /^\d{4}-\d{2}-\d{2}/.test(p.itemCreationDate || '') ? p.itemCreationDate?.slice(0, 10) : undefined,
      });
  }
  return result;
}

export type EbaySecrets = {
  EBAY_CLIENT_ID?: string;
  EBAY_CLIENT_SECRET?: string;
  EBAY_ENVIRONMENT?: string;
  EBAY_SANDBOX_CLIENT_ID?: string;
  EBAY_SANDBOX_CLIENT_SECRET?: string;
};

type EbayKeys = { host: string; id: string; secret: string; marketplace: string };

/** An application token for the Browse API (client credentials; no user data). */
async function ebayToken({ host, id, secret }: Omit<EbayKeys, 'marketplace'>) {
  const auth = JSON.parse(
    await safeFetch(`https://${host}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(id + ':' + secret)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    }),
  );
  if (typeof auth.access_token !== 'string')
    throw new CollectorError('credentials_required', 'eBay did not return an application token.');
  return auth.access_token as string;
}

/** Up to 50 active listings in Wristwatches (category 31387) on one eBay site, optionally filtered (e.g. new only). */
async function browseSearch(model: Model & { family?: string }, host: string, token: string, marketplace: string, filter?: string) {
  const url = new URL(`https://${host}/buy/browse/v1/item_summary/search`);
  url.searchParams.set('q', `${model.brand} ${baseReference(model.reference)}`);
  url.searchParams.set('category_ids', '31387');
  url.searchParams.set('limit', '50');
  if (filter) url.searchParams.set('filter', filter);
  const data: EbaySearchResponse = JSON.parse(
    await safeFetch(url.href, { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace } }),
  );
  if (data.errors?.length) throw new CollectorError('upstream_error', 'eBay returned an API error.');
  return parseEbayListings(data, model);
}

/** Browse API search on one eBay site (all conditions). */
export async function searchEbay(model: Model & { family?: string }, { host, id, secret, marketplace }: EbayKeys) {
  return browseSearch(model, host, await ebayToken({ host, id, secret }), marketplace);
}

/**
 * eBay sites searched for new-watch prices, one per region: the US; Germany, France and Italy (EU); Hong Kong and
 * Singapore (Asia). Each listing's item location decides its region, not the site.
 */
export const NEW_PRICE_MARKETPLACES = ['EBAY_US', 'EBAY_DE', 'EBAY_FR', 'EBAY_IT', 'EBAY_HK', 'EBAY_SG'];

/**
 * New-watch offers from business sellers (condition "New", eBay condition 1000) across NEW_PRICE_MARKETPLACES,
 * for the new-price comparison. Production keys only: sandbox listings are test data.
 */
export async function collectEbayNewOffers(model: Model & { family?: string }, secrets: EbaySecrets): Promise<CollectorResult> {
  const name = 'eBay new (dealers)';
  if (secrets.EBAY_ENVIRONMENT === 'sandbox' || !secrets.EBAY_CLIENT_ID || !secrets.EBAY_CLIENT_SECRET)
    return { listings: [], sources: [{ id: 'ebay-new', name, status: 'credentials_required', count: 0, message: 'New-watch prices from eBay dealers in the US, EU and Asia start once the production eBay keyset is enabled.' }] };
  const host = 'api.ebay.com';
  try {
    const token = await ebayToken({ host, id: secrets.EBAY_CLIENT_ID, secret: secrets.EBAY_CLIENT_SECRET });
    const sites = await Promise.allSettled(NEW_PRICE_MARKETPLACES.map((m) => browseSearch(model, host, token, m, 'conditionIds:{1000},buyingOptions:{FIXED_PRICE}')));
    const offers = new Map<string, LiveListing>();
    for (const site of sites)
      if (site.status === 'fulfilled')
        for (const l of site.value) if (l.condition === 'new' && l.sellerType === 'dealer' && !offers.has(l.url)) offers.set(l.url, l);
    const failed = sites.filter((x) => x.status === 'rejected').length;
    if (failed === sites.length) throw (sites[0] as PromiseRejectedResult).reason;
    const listings = [...offers.values()];
    return { listings, sources: [{ id: 'ebay-new', name, status: failed ? 'error' : 'ok', count: listings.length, message: `New, fixed-price offers from business sellers on eBay US, DE, FR, IT, HK and SG.${failed ? ` ${failed} site(s) unavailable.` : ''}` }] };
  } catch (e) {
    const message = errorMessage(e, 'eBay request failed');
    return { listings: [], sources: [{ id: 'ebay-new', name, status: /HTTP 401/.test(message) ? 'credentials_required' : failureStatus(e), count: 0, message }] };
  }
}

export async function collectEbay(
  model: Model & { family?: string },
  secrets: EbaySecrets,
  marketplace: string,
): Promise<CollectorResult> {
  const sandbox = secrets.EBAY_ENVIRONMENT === 'sandbox';
  const name = sandbox ? 'eBay (sandbox)' : 'eBay';
  const id = sandbox ? secrets.EBAY_SANDBOX_CLIENT_ID : secrets.EBAY_CLIENT_ID;
  const secret = sandbox ? secrets.EBAY_SANDBOX_CLIENT_SECRET : secrets.EBAY_CLIENT_SECRET;
  if (!id || !secret)
    return {
      listings: [],
      sources: [
        {
          id: 'ebay',
          name: 'eBay',
          status: 'credentials_required',
          count: 0,
          message: 'Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET on the server to include eBay.',
        },
      ],
    };
  try {
    const found = await searchEbay(model, {
      host: sandbox ? 'api.sandbox.ebay.com' : 'api.ebay.com',
      id,
      secret,
      marketplace,
    });
    // Sandbox listings are eBay's made-up test data: check the connection, never use them as prices.
    if (sandbox)
      return {
        listings: [],
        sources: [
          {
            id: 'ebay',
            name,
            status: 'ok',
            count: 0,
            message: `Sandbox connection works (${found.length} test listings, not used as prices). Set EBAY_ENVIRONMENT=production once the production keyset is enabled.`,
          },
        ],
      };
    return { listings: found, sources: [{ id: 'ebay', name, status: 'ok', count: found.length }] };
  } catch (e) {
    const message = errorMessage(e, 'eBay request failed');
    const rejected = /HTTP 401/.test(message) || (e instanceof CollectorError && e.code === 'credentials_required');
    return {
      listings: [],
      sources: [
        {
          id: 'ebay',
          name,
          status: rejected ? 'credentials_required' : 'error',
          count: 0,
          message: rejected
            ? `eBay rejected the ${sandbox ? 'sandbox' : 'production'} keys (invalid_client). A new production keyset stays disabled until the Marketplace Account Deletion step is done on developer.ebay.com; also check the Cert ID was copied in full.`
            : message,
        },
      ],
    };
  }
}
