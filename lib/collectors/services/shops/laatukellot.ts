import type { Model } from '../../../market';
import { collectedPrice, type ListingIdentity, type LiveListing } from '../../core/listing';
import { CollectorError } from '../../core/errors';
import { safeFetch } from '../../core/http';
import { classifyIdentity } from '../../matching/structured';
import { baseReference } from '../../matching/reference';

export function parseLaatukellot(body: unknown, model: Model, now = new Date()) {
  const products = (body as { products?: unknown[] })?.products;
  if (!Array.isArray(products)) throw new CollectorError('layout_changed', 'Laatukellot did not return its public shop search.');
  const listings: LiveListing[] = [], retailOffers: LiveListing[] = [];
  for (const raw of products.slice(0, 30)) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, any>;
    // A "new" badge on a used_watch means newly listed. Stock counts and RRP are not transaction prices.
    if (!['watch', 'used_watch'].includes(p.type) || p.available !== 1 || typeof p.brand !== 'string' || typeof p.model !== 'string' || typeof p.name !== 'string' || typeof p.url !== 'string' || !Number.isFinite(p.pricing?.current_price) || p.pricing.current_price <= 0) continue;
    let url: URL; try { url = new URL(p.url, 'https://www.laatukellot.fi/'); } catch { continue; }
    if (url.origin !== 'https://www.laatukellot.fi' || !/^\/[a-z0-9/-]+\/\d+$/i.test(url.pathname)) continue;
    const identity: ListingIdentity = { brand: p.brand, reference: p.model, dial: typeof p.tags?.dial_color?.value === 'string' ? p.tags.dial_color.value : undefined, sizeMm: typeof p.tags?.case_diameter?.value === 'number' ? p.tags.case_diameter.value : undefined };
    const title = `${p.name} Ref. ${p.model}${identity.dial ? ` · Dial: ${identity.dial}` : ''}`;
    const match = classifyIdentity(title, model, identity);
    if (!match) continue;
    const candidate = collectedPrice.safeParse({ modelId: model.id, sourceId: 'laatukellot', country: 'UNKNOWN', currency: 'EUR', price: p.pricing.current_price, status: 'asking', observedAt: now.toISOString().slice(0, 10), condition: p.type === 'used_watch' ? 'used' : 'new', sellerType: 'dealer', contents: p.tags?.box?.value === 1 && p.tags?.papers?.value === 1 ? 'full-set' : 'unknown', url: url.origin + url.pathname, title: title.slice(0, 500), collectedAt: now.toISOString() });
    if (candidate.success) (p.type === 'used_watch' ? listings : retailOffers).push({ ...candidate.data, match, identity });
  }
  return { listings, retailOffers };
}

export const laatukellot = {
  id: 'laatukellot', name: 'Laatukellot.fi',
  searchUrl: (m: Model) => `https://www.laatukellot.fi/search/${encodeURIComponent(baseReference(m.reference))}`,
  run: async (model: Model, fetcher: typeof fetch, now: Date) => parseLaatukellot(JSON.parse(await safeFetch(`https://www.laatukellot.fi/api/search-suggestions?${new URLSearchParams({ q: baseReference(model.reference) })}`, {}, fetcher)), model, now),
};
