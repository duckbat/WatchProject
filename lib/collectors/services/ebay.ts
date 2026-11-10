import { countries, type Model } from '../../market';
import { CollectorError, failureStatus } from '../core/errors';
import { safeFetch } from '../core/http';
import { ebayItemKey } from '../core/ebay-item';
import { type Candidate, collectedPrice, firstImage, type LiveListing } from '../core/listing';
import { type CollectorResult, errorMessage, exactCandidates } from '../core/result';
import { baseReference } from '../matching/reference';
import { classifyMatch } from '../matching/classify';

/** eBay converts a foreign listing's price to the site's currency; convertedFrom* is what the seller asked. */
type EbayAmount = { value?: string; currency?: string; convertedFromValue?: string; convertedFromCurrency?: string };

/** The seller's own price and currency, never eBay's conversion (a €10,450 listing shows as $11,644 on eBay US). */
function sellerAmount(a?: EbayAmount) {
  return a?.convertedFromValue && a.convertedFromCurrency
    ? { price: Number(a.convertedFromValue), currency: a.convertedFromCurrency }
    : { price: Number(a?.value), currency: a?.currency };
}

/** The parts of a Browse API item_summary/search response that are read. */
type EbayItem = {
  title?: string;
  itemWebUrl?: string;
  itemLocation?: { country?: string };
  price?: EbayAmount;
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
  return parseEbayItems(body?.itemSummaries || [], model, now, (p) => ({ amount: p.price, status: 'asking', observedAt: now.toISOString().slice(0, 10) }));
}

/** The parts of a Marketplace Insights item_sales/search response that are read (sales of the last 90 days). */
type EbaySale = EbayItem & { lastSoldDate?: string; lastSoldPrice?: EbayAmount };
export type EbaySalesResponse = { itemSales?: EbaySale[]; errors?: unknown[] };

/** Completed eBay sales: the price paid and the date of the last sale, as confirmed sales. */
export function parseEbaySales(body: EbaySalesResponse, model: Model & { family?: string }, now = new Date()): LiveListing[] {
  return parseEbayItems(body?.itemSales || [], model, now, (p) =>
    /^\d{4}-\d{2}-\d{2}/.test(p.lastSoldDate || '') ? { amount: p.lastSoldPrice, status: 'confirmed-sale', observedAt: p.lastSoldDate!.slice(0, 10) } : null,
  );
}

function parseEbayItems<T extends EbayItem>(
  items: T[],
  model: Model & { family?: string },
  now: Date,
  priceOf: (p: T) => { amount?: EbayAmount; status: 'asking' | 'confirmed-sale'; observedAt: string } | null,
): LiveListing[] {
  const result: LiveListing[] = [];
  for (const p of items.slice(0, 200)) {
    const priced = priceOf(p);
    if (!priced) continue;
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
    const { price, currency } = sellerAmount(priced.amount);
    const c = collectedPrice.safeParse({
      modelId: model.id,
      sourceId: 'ebay',
      country: location && location in countries ? location : 'UNKNOWN',
      currency,
      price,
      status: priced.status,
      observedAt: priced.observedAt,
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
    const canonicalUrl = ebayItemKey(c.success ? c.data.url : '');
    if (c.success && !result.some((r) => (r.canonicalUrl || r.url) === (canonicalUrl || c.data.url)))
      result.push({
        ...c.data,
        canonicalUrl,
        match,
        image: firstImage(p.image?.imageUrl || p.thumbnailImages),
        listedAt: /^\d{4}-\d{2}-\d{2}/.test(p.itemCreationDate || '') ? p.itemCreationDate?.slice(0, 10) : undefined,
      });
  }
  return result;
}

/** Counts eBay API calls (tokens and searches) for the daily call budget (lib/market-archive/ebay-budget.ts). */
export type EbayUsage = { calls: number };

export type EbaySecrets = {
  ebayUsage?: EbayUsage;
  EBAY_CLIENT_ID?: string;
  EBAY_CLIENT_SECRET?: string;
  EBAY_ENVIRONMENT?: string;
  EBAY_SANDBOX_CLIENT_ID?: string;
  EBAY_SANDBOX_CLIENT_SECRET?: string;
};

type EbayKeys = { host: string; id: string; secret: string; marketplace: string };

const BROWSE_SCOPE = 'https://api.ebay.com/oauth/api_scope';
/** Sold items; eBay grants this scope only to approved applications (Marketplace Insights, a limited-release API). */
const INSIGHTS_SCOPE = 'https://api.ebay.com/oauth/api_scope/buy.marketplace.insights';

/** An application token (client credentials; no user data). */
async function ebayToken({ host, id, secret }: Omit<EbayKeys, 'marketplace'>, scope = BROWSE_SCOPE, usage?: EbayUsage) {
  if (usage) usage.calls++;
  const auth = JSON.parse(
    await safeFetch(`https://${host}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(id + ':' + secret)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`,
    }),
  );
  if (typeof auth.access_token !== 'string')
    throw new CollectorError('credentials_required', 'eBay did not return an application token.');
  return auth.access_token as string;
}

/** Up to 200 active listings in Wristwatches (category 31387) on one eBay site, optionally filtered (e.g. new only). */
async function browseSearch(model: Model & { family?: string }, host: string, token: string, marketplace: string, filter?: string, usage?: EbayUsage) {
  if (usage) usage.calls++;
  const url = new URL(`https://${host}/buy/browse/v1/item_summary/search`);
  url.searchParams.set('q', `${model.brand} ${baseReference(model.reference)}`);
  url.searchParams.set('category_ids', '31387');
  url.searchParams.set('limit', '200');
  if (filter) url.searchParams.set('filter', filter);
  const data: EbaySearchResponse = JSON.parse(
    await safeFetch(url.href, { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace } }),
  );
  if (data.errors?.length) throw new CollectorError('upstream_error', 'eBay returned an API error.');
  return parseEbayListings(data, model);
}

/**
 * eBay sites searched for listings besides EBAY_MARKETPLACE. Each site mostly shows its own country's sellers (eBay DE
 * had 28 listings of a Rolex 124060 where eBay US had 199), so one site misses most of the market. Each listing's item
 * location decides its region, and an item listed on several sites counts once.
 */
export const LISTING_MARKETPLACES = ['EBAY_US', 'EBAY_GB', 'EBAY_DE'];

/** Runs one search per site and merges the results by eBay item; fails only when every site failed. */
async function acrossSites(sites: string[], search: (marketplace: string) => Promise<LiveListing[]>) {
  const settled = await Promise.allSettled(sites.map(search));
  const items = new Map<string, LiveListing>();
  for (const site of settled) if (site.status === 'fulfilled') for (const l of site.value) if (!items.has(l.canonicalUrl || l.url)) items.set(l.canonicalUrl || l.url, l);
  const failed = settled.filter((x) => x.status === 'rejected').length;
  if (failed === settled.length) throw (settled[0] as PromiseRejectedResult).reason;
  return { listings: [...items.values()], failed };
}

/** Browse API search on the given eBay sites (all conditions), the first site's links kept for duplicates. */
export async function searchEbay(model: Model & { family?: string }, { host, id, secret }: Omit<EbayKeys, 'marketplace'>, sites: string[], usage?: EbayUsage) {
  const token = await ebayToken({ host, id, secret }, BROWSE_SCOPE, usage);
  return acrossSites(sites, (m) => browseSearch(model, host, token, m, undefined, usage));
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
    const token = await ebayToken({ host, id: secrets.EBAY_CLIENT_ID, secret: secrets.EBAY_CLIENT_SECRET }, BROWSE_SCOPE, secrets.ebayUsage);
    const sites = await Promise.allSettled(NEW_PRICE_MARKETPLACES.map((m) => browseSearch(model, host, token, m, 'conditionIds:{1000},buyingOptions:{FIXED_PRICE}', secrets.ebayUsage)));
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
  const sites = sandbox ? [marketplace] : [...new Set([marketplace, ...LISTING_MARKETPLACES])];
  try {
    const { listings: found, failed } = await searchEbay(model, { host: sandbox ? 'api.sandbox.ebay.com' : 'api.ebay.com', id, secret }, sites, secrets.ebayUsage);
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
    const siteNames = sites.map((m) => m.replace('EBAY_', '')).join(', ');
    return { listings: found, sources: [{ id: 'ebay', name, status: failed ? 'error' : 'ok', count: found.length, message: `Active listings on eBay ${siteNames}.${failed ? ` ${failed} site(s) unavailable.` : ''}` }] };
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

/**
 * Completed sales (price paid and sale date) from eBay's Marketplace Insights API, on the same sites as listings.
 * eBay grants it only to approved applications; until then the chip says so and sold listings can be saved from
 * eBay's own sold-items search with the Save to WatchLedger button.
 */
export async function collectEbaySold(model: Model & { family?: string }, secrets: EbaySecrets, marketplace: string): Promise<CollectorResult> {
  const name = 'eBay sold';
  const manual = 'Meanwhile, open eBay\'s sold-items search and use the Save to WatchLedger button to add the sales on that page.';
  if (secrets.EBAY_ENVIRONMENT === 'sandbox' || !secrets.EBAY_CLIENT_ID || !secrets.EBAY_CLIENT_SECRET)
    return { listings: [], sources: [{ id: 'ebay-sold', name, status: 'credentials_required', count: 0, message: `eBay sold prices need the production eBay keys. ${manual}` }] };
  const host = 'api.ebay.com';
  let token: string;
  try {
    token = await ebayToken({ host, id: secrets.EBAY_CLIENT_ID, secret: secrets.EBAY_CLIENT_SECRET }, INSIGHTS_SCOPE, secrets.ebayUsage);
  } catch {
    // eBay answers invalid_scope (HTTP 400) until the application is approved for Marketplace Insights.
    return { listings: [], sources: [{ id: 'ebay-sold', name, status: 'credentials_required', count: 0, message: `eBay shares sold prices only through its Marketplace Insights API, which needs eBay's approval for this application (see MARKETPLACES.md). ${manual}` }] };
  }
  const sites = [...new Set([marketplace, ...LISTING_MARKETPLACES])];
  try {
    const { listings, failed } = await acrossSites(sites, async (m) => {
      if (secrets.ebayUsage) secrets.ebayUsage.calls++;
      const url = new URL(`https://${host}/buy/marketplace_insights/v1_beta/item_sales/search`);
      url.searchParams.set('q', `${model.brand} ${baseReference(model.reference)}`);
      url.searchParams.set('category_ids', '31387');
      url.searchParams.set('limit', '200');
      const data: EbaySalesResponse = JSON.parse(await safeFetch(url.href, { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': m } }));
      if (data.errors?.length) throw new CollectorError('upstream_error', 'eBay returned an API error.');
      return parseEbaySales(data, model);
    });
    return { listings, sources: [{ id: 'ebay-sold', name, status: failed ? 'error' : 'ok', count: listings.length, message: `Sales of the last 90 days on eBay ${sites.map((m) => m.replace('EBAY_', '')).join(', ')}.${failed ? ` ${failed} site(s) unavailable.` : ''}` }] };
  } catch (e) {
    return { listings: [], sources: [{ id: 'ebay-sold', name, status: failureStatus(e), count: 0, message: errorMessage(e, 'eBay sold search failed') }] };
  }
}
