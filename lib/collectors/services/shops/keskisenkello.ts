import type { Model } from '../../../market';
import { collectedPrice, type ListingIdentity, type LiveListing } from '../../core/listing';
import { CollectorError } from '../../core/errors';
import { safeFetch } from '../../core/http';
import { classifyIdentity } from '../../matching/structured';
import { baseReference, compact } from '../../matching/reference';

export function parseKeskisenKello(body: unknown, model: Model, now = new Date()) {
  const hits = (body as { hits?: unknown[] })?.hits;
  if (!Array.isArray(hits)) throw new CollectorError('layout_changed', 'Keskisen Kello did not return public shop results.');
  const retailOffers: LiveListing[] = [];
  for (const raw of hits.slice(0, 15)) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, any>;
    if (![true, 1].includes(p.in_stock) || typeof p.name !== 'string' || typeof p.brand_feed !== 'string' || typeof p.url !== 'string') continue;
    // Search may suggest a nearby model or a replacement strap. Only an explicit reference in the actual title counts.
    const ref = (p.name.match(/[a-z0-9]+(?:[.\/-][a-z0-9]+)*/gi) || []).find((v: string) => compact(baseReference(v)) === compact(baseReference(model.reference)));
    if (!ref) continue;
    const identity: ListingIdentity = { brand: p.brand_feed, reference: ref, dial: typeof p.kk_taulun_vari === 'string' ? p.kk_taulun_vari : undefined };
    const match = classifyIdentity(p.name, model, identity);
    if (!match) continue;
    let url: URL; try { url = new URL(p.url); } catch { continue; }
    if (url.origin !== 'https://www.keskisenkello.fi' || !url.pathname.startsWith('/catalog/product/view/id/')) continue;
    const candidate = collectedPrice.safeParse({ modelId: model.id, sourceId: 'keskisenkello', country: 'FI', currency: 'EUR', price: p.price?.EUR?.default, status: 'asking', observedAt: now.toISOString().slice(0, 10), condition: 'new', sellerType: 'dealer', contents: 'unknown', url: url.origin + url.pathname, title: `${p.name}${identity.dial ? ` · Dial: ${identity.dial}` : ''}`.slice(0, 500), collectedAt: now.toISOString() });
    if (candidate.success) retailOffers.push({ ...candidate.data, match, identity, image: typeof p.thumbnail_url === 'string' && p.thumbnail_url.startsWith('https://www.keskisenkello.fi/') ? p.thumbnail_url : undefined });
  }
  return { listings: [] as LiveListing[], retailOffers };
}

export const keskisenkello = {
  id: 'keskisenkello', name: 'Keskisen Kello',
  searchUrl: (m: Model) => `https://www.keskisenkello.fi/catalogsearch/result/?${new URLSearchParams({ q: baseReference(m.reference) })}`,
  run: async (model: Model, fetcher: typeof fetch, now: Date) => {
    const html = await safeFetch(keskisenkello.searchUrl(model), {}, fetcher);
    const raw = html.match(/window\.algoliaConfig\s*=\s*(\{[^\n]+\});/)?.[1];
    if (!raw) throw new CollectorError('layout_changed', 'Keskisen Kello public search configuration changed.');
    const c = JSON.parse(raw);
    if (!/^[A-Z0-9]{6,20}$/.test(c.applicationId) || !/^[a-z0-9_]{1,100}$/.test(c.indexName) || typeof c.apiKey !== 'string' || c.apiKey.length > 1000) throw new CollectorError('layout_changed', 'Keskisen Kello search configuration is invalid.');
    // The shop publishes this restricted search credential in its storefront; no account or private data is accessed.
    const body = await safeFetch(`https://${c.applicationId.toLowerCase()}-dsn.algolia.net/1/indexes/${c.indexName}_products/query`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Algolia-Application-Id': c.applicationId, 'X-Algolia-API-Key': c.apiKey }, body: JSON.stringify({ query: baseReference(model.reference), hitsPerPage: 15, typoTolerance: false, removeWordsIfNoResults: 'none' }) }, fetcher);
    return parseKeskisenKello(JSON.parse(body), model, now);
  },
};
