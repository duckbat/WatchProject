import type { Model } from '../../../market';
import { CollectorError } from '../../core/errors';
import { safeFetch } from '../../core/http';
import { collectedPrice, type LiveListing } from '../../core/listing';
import { classifyMatch } from '../../matching/classify';
import { baseReference } from '../../matching/reference';
import { type AuctionHouse, dateOf, headers, multipleWatches, plain } from './shared';

/** Auctionet's public item API (Nordic, UK and EU houses). Only sold lots count; the closing bid excludes buyer's premium. */
type AuctionetItem = {
  state?: unknown;
  title?: unknown;
  description?: unknown;
  condition?: unknown;
  bids?: { amount?: unknown; timestamp?: unknown }[];
  ends_at?: unknown;
  url?: unknown;
  house?: unknown;
  currency?: unknown;
  images?: { w640?: unknown }[];
};

export function parseAuctionet(body: unknown, model: Model, now = new Date()): LiveListing[] {
  const items = (body as { items?: AuctionetItem[] } | null)?.items;
  if (!Array.isArray(items))
    throw new CollectorError('layout_changed', 'Auctionet did not return its public item data.');
  const listings: LiveListing[] = [];
  for (const item of items.slice(0, 100)) {
    if (item?.state !== 'sold' || !Array.isArray(item.bids) || typeof item.title !== 'string') continue; // Unsold, open or withdrawn lots are not sales.
    const bids = item.bids.filter((b) => Number.isFinite(Number(b?.amount)) && Number(b.amount) > 0);
    if (!bids.length) continue;
    const top = bids.reduce((a, b) => (Number(b.amount) > Number(a.amount) ? b : a));
    const title = plain(item.title),
      details = plain(`${item.description || ''} ${item.condition || ''}`).slice(0, 2000);
    if (multipleWatches.test(`${title} ${details}`)) continue;
    const match = classifyMatch(title, model, details);
    // A live-hammer sale can close after the online end time; the winning bid's time is the sale date.
    const closed = Math.max(Number(item.ends_at) || 0, Number(top.timestamp) || 0);
    const date = closed ? dateOf(new Date(closed * 1000).toISOString(), now) : null;
    let url: URL;
    try {
      url = new URL(String(item.url));
    } catch {
      continue;
    }
    if (!match || !date || url.origin !== 'https://auctionet.com' || !/^\/[a-z]{2}\/[\w/-]+$/.test(url.pathname))
      continue;
    const house = typeof item.house === 'string' ? plain(item.house).slice(0, 80) : 'Auctionet';
    const candidate = collectedPrice.safeParse({
      modelId: model.id,
      sourceId: 'auctionet',
      country: 'UNKNOWN',
      currency: item.currency,
      price: Number(top.amount),
      status: 'confirmed-sale',
      observedAt: date,
      condition: 'unknown',
      sellerType: 'unknown',
      contents: 'unknown',
      url: url.origin + url.pathname,
      title: `${title} · ${house} via Auctionet, winning bid (buyer’s premium excluded)`.slice(0, 500),
      collectedAt: now.toISOString(),
    });
    const image = item.images?.[0]?.w640;
    if (candidate.success && !listings.some((l) => l.url === candidate.data.url))
      listings.push({
        ...candidate.data,
        match,
        matchDetails: details,
        listedAt: date,
        image: typeof image === 'string' && image.startsWith('https://images.auctionet.com/') ? image : undefined,
      });
  }
  return listings;
}

const auctionetApi = (q: string) =>
  `https://auctionet.com/api/v2/items.json?${new URLSearchParams({ q, is: 'ended', per_page: '50' })}`;

export const auctionet: AuctionHouse = {
  id: 'auctionet',
  name: 'Auctionet',
  searchUrl: (model) =>
    `https://auctionet.com/en/search?${new URLSearchParams({ q: `${model.brand} ${baseReference(model.reference)}`, is: 'ended' })}`,
  run: async (model, fetcher, now) => {
    // Nordic houses often leave the reference out of the title, so the model family is searched too; matching decides what counts.
    // Catalog names spell out the variant ("… Stainless Steel / Black / Bracelet"); the family is what lot titles use.
    const queries = [
      `${model.brand} ${baseReference(model.reference)}`,
      `${model.brand} ${model.family || model.name}`,
    ];
    const pages = await Promise.all(
      queries.map(async (q) => {
        let body: unknown;
        try {
          body = JSON.parse(
            await safeFetch(auctionetApi(q), { headers: { ...headers, Accept: 'application/json' } }, fetcher),
          );
        } catch (e) {
          if (e instanceof CollectorError) throw e;
          throw new CollectorError('layout_changed', 'Auctionet did not return JSON.');
        }
        return parseAuctionet(body, model, now);
      }),
    );
    return {
      listings: pages.flat().filter((l, i, all) => all.findIndex((o) => o.url === l.url) === i),
      message:
        'Sold lots among the 50 most relevant ended auctions for the reference and for the model family. Winning bid shown; buyer’s premium is extra.',
    };
  },
};
