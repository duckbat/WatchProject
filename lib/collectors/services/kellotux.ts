import { countries, type Model } from '../../market';
import { safeFetch } from '../core/http';
import { CollectorError, failureStatus } from '../core/errors';
import { collectedPrice, type LiveListing, type ListingIdentity } from '../core/listing';
import { type CollectorResult, errorMessage } from '../core/result';
import { classifyIdentity } from '../matching/structured';
import { baseReference } from '../matching/reference';

const fields = 'id,brand,model,reference_number,dial_color,size,country,price,status,listing_type,sold_on_site,sold_price,content_updated_at,created,expires_at,deleted,collectionId,image,source_url,set_included,expand.user.seller_type';
export function parseKellotux(body: unknown, model: Model, now = new Date()): LiveListing[] {
  const items = (body as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) throw new CollectorError('layout_changed', 'Kellotux did not return public listings.');
  const out: LiveListing[] = [];
  for (const raw of items.slice(0, 60)) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, any>;
    if (p.deleted || p.listing_type !== 'sell' || !['active', 'sold'].includes(p.status) || !/^[a-z0-9]{15}$/.test(p.id) || (p.expires_at && (!Number.isFinite(+new Date(p.expires_at)) || +new Date(p.expires_at) <= +now))) continue;
    if (typeof p.brand !== 'string' || typeof p.model !== 'string' || typeof p.reference_number !== 'string') continue;
    const identity: ListingIdentity = { brand: p.brand, reference: p.reference_number, dial: typeof p.dial_color === 'string' ? p.dial_color : undefined, sizeMm: typeof p.size === 'number' && p.size > 0 ? p.size : undefined };
    const title = `${p.brand} ${p.model} Ref. ${p.reference_number}${identity.dial ? ` · Dial: ${identity.dial}` : ''}`;
    const match = classifyIdentity(title, model, identity);
    if (!match) continue;
    const sold = p.status === 'sold';
    // A sold flag alone only supports the last ask. A separate positive sold_price is a seller-reported amount.
    const reported = sold && p.sold_on_site === true && typeof p.sold_price === 'number' && p.sold_price > 0;
    const price = reported ? p.sold_price : p.price;
    const date = !sold && typeof p.content_updated_at === 'string' && Number.isFinite(+new Date(p.content_updated_at)) && +new Date(p.content_updated_at) <= +now ? p.content_updated_at.slice(0, 10) : undefined;
    const candidate = collectedPrice.safeParse({ modelId: model.id, sourceId: 'kellotux', country: typeof p.country === 'string' && p.country in countries ? p.country : 'UNKNOWN', currency: 'EUR', price, status: reported ? 'confirmed-sale' : sold ? 'sold-asking' : 'asking', observedAt: now.toISOString().slice(0, 10), condition: 'unknown', sellerType: p.expand?.user?.seller_type === 'business' ? 'dealer' : p.expand?.user?.seller_type === 'private' ? 'private' : 'unknown', contents: p.set_included === 'full_set' ? 'full-set' : p.set_included === 'watch_only' ? 'watch-only' : 'unknown', url: `https://kellotux.com/listing/${p.id}`, title: `${title}${reported ? ' · Seller-reported sale; sale date unavailable' : ''}`.slice(0, 500), collectedAt: now.toISOString() });
    if (!candidate.success) continue;
    let canonicalUrl: string | undefined;
    try {
      const u = new URL(p.source_url);
      if (u.protocol === 'https:' && !u.username && !u.password && u.pathname !== '/') {
        for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key);
        canonicalUrl = u.origin + u.pathname + u.search;
      }
    } catch { /* No original dealer URL. */ }
    const file = Array.isArray(p.image) && typeof p.image[0] === 'string' && /^[\w.-]+$/.test(p.image[0]) ? p.image[0] : null;
    out.push({ ...candidate.data, match, identity, listedAt: date, canonicalUrl, image: file ? `https://api.kellotux.com/api/files/watch_listings/${p.id}/${file}?thumb=600x600` : undefined });
  }
  return out;
}

export async function collectKellotux(model: Model, fetcher: typeof fetch = fetch, now = new Date()): Promise<CollectorResult> {
  const query = baseReference(model.reference), escaped = query.replace(/["\\]/g, '\\$&');
  const searchUrl = `https://kellotux.com/listings?${new URLSearchParams({ reference: query })}`;
  const source = { id: 'kellotux', name: 'Kellotux.com', searchUrl };
  try {
    const url = `https://api.kellotux.com/api/collections/watch_listings/records?${new URLSearchParams({ page: '1', perPage: '60', sort: '-content_updated_at', expand: 'user', fields, filter: `deleted != true && listing_type = "sell" && (expires_at = "" || expires_at > @now) && reference_number ~ "${escaped}"` })}`;
    const listings = parseKellotux(JSON.parse(await safeFetch(url, {}, fetcher)), model, now);
    return { listings, sources: [{ ...source, status: 'ok', count: listings.length, message: 'Used-market asking prices. Sold flags are last asks unless a separate seller-reported sold amount exists; unknown sale dates stay undated. Original dealer URLs identify duplicates.' }] };
  } catch (e) { return { listings: [], sources: [{ ...source, status: failureStatus(e), count: 0, message: errorMessage(e, 'Kellotux unavailable') }] }; }
}
