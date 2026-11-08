import type { Model } from '../../market';
import { collectedPrice, type LiveListing } from '../core/listing';
import { safeFetch } from '../core/http';
import { CollectorError, failureStatus } from '../core/errors';
import { type CollectorResult, errorMessage } from '../core/result';
import { classifyMatch, exactMatch } from '../matching/classify';
import { baseReference } from '../matching/reference';
import { dateOf, multipleWatches, plain } from './auctions/shared';

export function parseHuutoSale(raw: unknown, model: Model, now = new Date()): LiveListing | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, any>;
  if (p.status !== 'closed' || !Number.isInteger(p.id) || typeof p.title !== 'string') return null;
  // Huuto documents purchases=null until an item is closed AND sold. Never fetch that private purchase endpoint.
  if (p.links?.purchases !== `https://api.huuto.net/1.1/items/${p.id}/purchases`) return null;
  const title = plain(p.title), details = typeof p.description === 'string' ? plain(p.description).slice(0, 2000) : '';
  if (multipleWatches.test(`${title} ${details}`)) return null;
  const match = classifyMatch(title, model, details), date = typeof p.closingTime === 'string' ? dateOf(p.closingTime, now) : null;
  if (!match || !date || !['auction', 'buy-now'].includes(p.saleMethod)) return null;
  if (p.saleMethod === 'auction' && (!(p.bidderCount > 0) || (p.hasReservePrice && p.hasReservePriceExceeded !== true))) return null;
  let url: URL; try { url = new URL(p.links.alternative); } catch { return null; }
  if (url.origin !== 'https://www.huuto.net' || !new RegExp(`^/kohteet/[^/]+/${p.id}$`, 'i').test(url.pathname)) return null;
  const auction = p.saleMethod === 'auction';
  const candidate = collectedPrice.safeParse({ modelId: model.id, sourceId: 'huuto', country: 'FI', currency: 'EUR', price: p.currentPrice, status: auction ? 'confirmed-sale' : 'sold-asking', observedAt: date, condition: p.condition === 'new' ? 'new' : ['like-new', 'good', 'acceptable', 'weak'].includes(p.condition) ? 'used' : 'unknown', sellerType: 'unknown', contents: 'unknown', url: url.origin + url.pathname, title: `${title} · Huuto.net ${auction ? 'sold auction, closing bid' : 'sold listing, last advertised price'}`.slice(0, 500), collectedAt: now.toISOString() });
  return candidate.success ? { ...candidate.data, match, matchDetails: details, listedAt: date } : null;
}

export async function collectHuuto(model: Model, fetcher: typeof fetch = fetch, now = new Date()): Promise<CollectorResult> {
  const q = `${model.brand} ${baseReference(model.reference)}`, source = { id: 'huuto', name: 'Huuto.net sold listings', searchUrl: `https://www.huuto.net/haku?${new URLSearchParams({ words: q, status: 'closed' })}` };
  try {
    const pages = await Promise.allSettled([193, 195].map(async category => {
      const body = JSON.parse(await safeFetch(`https://api.huuto.net/1.1/categories/${category}/items/closed?${new URLSearchParams({ words: q })}`, {}, fetcher));
      if (!Array.isArray(body.items)) throw new CollectorError('layout_changed', 'Huuto.net did not return public closed listings.');
      return body.items.slice(0, 50) as { id: number; title: string }[];
    }));
    if (pages.every(p => p.status === 'rejected')) throw (pages[0] as PromiseRejectedResult).reason;
    const ids = [...new Set(pages.flatMap(p => p.status === 'fulfilled' ? p.value : []).filter(p => Number.isInteger(p.id) && typeof p.title === 'string' && exactMatch(p.title, { ...model, reference: baseReference(model.reference) })).map(p => p.id))].slice(0, 4);
    // shortcut: first closed-listing pages and four matching details per reference; historical coverage grows through the archive.
    const lots = await Promise.allSettled(ids.map(async id => parseHuutoSale(JSON.parse(await safeFetch(`https://api.huuto.net/1.1/items/${id}`, {}, fetcher)), model, now)));
    const listings = lots.flatMap(l => l.status === 'fulfilled' && l.value ? [l.value] : []);
    const failed = pages.some(p => p.status === 'rejected') || lots.some(p => p.status === 'rejected');
    return { listings, sources: [{ ...source, status: failed ? 'error' : 'ok', count: listings.length, message: 'Public sold marker required. Auctions use the closing bid; fixed-price sold listings retain the last ask because accepted offers may differ. Closed-but-unsold lots are excluded.' }] };
  } catch (e) { return { listings: [], sources: [{ ...source, status: failureStatus(e), count: 0, message: errorMessage(e, 'Huuto.net unavailable') }] }; }
}
