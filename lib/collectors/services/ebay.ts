import { countries, type Model } from '../../market';
import { CollectorError } from '../core/errors';
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
    if (link.protocol !== 'https:' || !/(^|\.)ebay\.(com|de|co\.uk|fr|it|es)$/.test(link.hostname)) continue;
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

/** Browse API: an application token, then up to 50 active listings in Wristwatches (category 31387). */
export async function searchEbay(model: Model & { family?: string }, { host, id, secret, marketplace }: EbayKeys) {
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
  const url = new URL(`https://${host}/buy/browse/v1/item_summary/search`);
  url.searchParams.set('q', `${model.brand} ${baseReference(model.reference)}`);
  url.searchParams.set('category_ids', '31387');
  url.searchParams.set('limit', '50');
  const data: EbaySearchResponse = JSON.parse(
    await safeFetch(url.href, {
      headers: { Authorization: `Bearer ${auth.access_token}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace },
    }),
  );
  if (data.errors?.length) throw new CollectorError('upstream_error', 'eBay returned an API error.');
  return parseEbayListings(data, model);
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
