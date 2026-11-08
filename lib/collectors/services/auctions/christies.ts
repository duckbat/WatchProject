import type { Model } from '../../../market';
import { CollectorError } from '../../core/errors';
import { safeFetch } from '../../core/http';
import { collectedPrice, type LiveListing } from '../../core/listing';
import { classifyMatch } from '../../matching/classify';
import { type AuctionHouse, dateOf, headers, multipleWatches, plain } from './shared';

/** The fields of a lot in Christie's catalogue data that are read; values are checked before use. */
export type ChristiesLot = {
  title_primary_txt?: unknown;
  title_secondary_txt?: unknown;
  description_txt?: unknown;
  end_date?: unknown;
  price_realised?: unknown;
  price_realised_txt?: unknown;
  is_unsold?: boolean;
  lot_withdrawn?: boolean;
  is_open_for_bidding?: boolean;
  url?: unknown;
  image?: { image_src?: unknown };
};

export function christiesCatalogue(html: string): { lots: ChristiesLot[]; pages: number } {
  const raw = html.match(/window\.chrComponents\s*=\s*(\{[^\n]+\});/)?.[1];
  let data: { lots?: unknown; total_pages?: unknown } | undefined;
  try {
    data = raw && JSON.parse(raw)?.lots?.data;
  } catch {
    /* Report a changed public page, never evaluate its scripts. */
  }
  if (!Array.isArray(data?.lots))
    throw new CollectorError('layout_changed', 'Christie’s did not return its public catalogue data.');
  return { lots: data!.lots as ChristiesLot[], pages: Number(data!.total_pages) || 1 };
}

export function parseChristies(lots: ChristiesLot[], model: Model, now = new Date()): LiveListing[] {
  const listings: LiveListing[] = [];
  for (const lot of lots.slice(0, 400)) {
    const title = plain(
      [lot.title_primary_txt, lot.title_secondary_txt].filter((v) => typeof v === 'string').join(' '),
    );
    const details = typeof lot.description_txt === 'string' ? plain(lot.description_txt).slice(0, 2000) : '';
    if (multipleWatches.test(`${title} ${details}`)) continue;
    const match = classifyMatch(title, model, details),
      date = typeof lot.end_date === 'string' ? dateOf(lot.end_date, now) : null;
    const amount =
      typeof lot.price_realised === 'string' || typeof lot.price_realised === 'number'
        ? Number(lot.price_realised)
        : NaN;
    const currency =
      typeof lot.price_realised_txt === 'string' ? lot.price_realised_txt.match(/^([A-Z]{3})\s/)?.[1] : undefined;
    if (
      !match ||
      !date ||
      !currency ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      lot.is_unsold ||
      lot.lot_withdrawn ||
      lot.is_open_for_bidding
    )
      continue;
    let url: URL;
    try {
      if (typeof lot.url !== 'string') continue;
      url = new URL(lot.url, 'https://onlineonly.christies.com');
    } catch {
      continue;
    }
    if (url.origin !== 'https://onlineonly.christies.com' || !/^\/s\/[a-z0-9-]+\/[a-z0-9-]+\/\d+$/.test(url.pathname))
      continue;
    const candidate = collectedPrice.safeParse({
      modelId: model.id,
      sourceId: 'christies',
      country: 'UNKNOWN',
      currency,
      price: amount,
      status: 'confirmed-sale',
      observedAt: date,
      condition: 'unknown',
      sellerType: 'unknown',
      contents: 'unknown',
      url: url.origin + url.pathname,
      title: `${title} · Christie’s price realised (buyer’s premium included)`.slice(0, 500),
      collectedAt: now.toISOString(),
    });
    const image = lot.image?.image_src;
    if (candidate.success && !listings.some((l) => l.url === candidate.data.url))
      listings.push({
        ...candidate.data,
        match,
        matchDetails: details,
        listedAt: date,
        image: typeof image === 'string' && image.startsWith('https://') ? image : undefined,
      });
  }
  return listings;
}

// shortcut: two public Geneva catalogues, up to four cumulative pages each; expand the catalogue list when global discovery is available.
export const CHRISTIES_CATALOGUES = [
  'https://onlineonly.christies.com/s/watches-online-geneva-edit/lots/3914',
  'https://onlineonly.christies.com/s/watches-online-geneva-edit/lots/3335',
];

/** Catalogue pages are identical for every watch, so they are fetched once per isolate per 6 hours (live fetch only). */
const CATALOGUE_TTL_MS = 6 * 3_600_000;
const catalogueCache = new Map<string, { at: number; html: Promise<string> }>();

function fetchCatalogue(url: string, fetcher: typeof fetch) {
  if (fetcher !== fetch) return safeFetch(url, { headers }, fetcher);
  const hit = catalogueCache.get(url);
  if (hit && Date.now() - hit.at < CATALOGUE_TTL_MS) return hit.html;
  const html = safeFetch(url, { headers }, fetcher);
  catalogueCache.set(url, { at: Date.now(), html });
  html.catch(() => catalogueCache.delete(url)); // Never cache a failure.
  return html;
}

export const christies: AuctionHouse = {
  id: 'christies',
  name: 'Christie’s',
  searchUrl: () => CHRISTIES_CATALOGUES[0],
  run: async (model, fetcher, now) => {
    const pages = await Promise.allSettled(
      CHRISTIES_CATALOGUES.map(async (url) => {
        const first = christiesCatalogue(await fetchCatalogue(url, fetcher));
        const page = Math.min(first.pages, 4);
        const lots =
          page > 1 ? christiesCatalogue(await fetchCatalogue(`${url}?page=${page}`, fetcher)).lots : first.lots;
        return parseChristies(lots, model, now);
      }),
    );
    const failed = pages.filter((p) => p.status === 'rejected');
    if (failed.length === pages.length) throw (failed[0] as PromiseRejectedResult).reason;
    return {
      listings: pages.flatMap((p) => (p.status === 'fulfilled' ? p.value : [])),
      failed: failed.length,
      message: `Published prices realised, including buyer’s premium. Limited to the Geneva online catalogues of December 2023 and October 2026.${failed.length ? ` ${failed.length} catalogue unavailable.` : ''}`,
    };
  },
};
