import type { Model } from '../../market';
import { CollectorError, failureStatus } from '../core/errors';
import { safeFetch } from '../core/http';
import { type Candidate, collectedPrice, firstImage, type LiveListing } from '../core/listing';
import { addListings, type CollectorResult, errorMessage, exactCandidates, type SourceStatus } from '../core/result';
import { classifyMatch } from '../matching/classify';
import { soldWord } from '../matching/keywords';

/** Nordic classifieds on the same "recommerce" platform: identical search URLs and structured data. */
export const RECOMMERCE_SITES = {
  tori: { name: 'Tori.fi', host: 'www.tori.fi', country: 'FI' },
  finn: { name: 'FINN.no', host: 'www.finn.no', country: 'NO' },
  blocket: { name: 'Blocket', host: 'www.blocket.se', country: 'SE' },
  dba: { name: 'DBA', host: 'www.dba.dk', country: 'DK' },
} as const;

export type RecommerceSite = keyof typeof RECOMMERCE_SITES;

/** The parts of the search page's schema.org ItemList that are read. */
type Offer = { availability?: string; price?: unknown; priceCurrency?: unknown; itemCondition?: string };
type Product = { name?: string; url?: string; image?: unknown; itemCondition?: string; offers?: Offer };
type ItemList = { mainEntity?: { itemListElement?: { item?: Product }[] } };

const recommerceHeaders = { 'User-Agent': 'WatchProject/1.0 (personal watch price tracker)', Accept: 'text/html' };

const recommerceSearchUrl = (site: RecommerceSite, q: string) =>
  `https://${RECOMMERCE_SITES[site].host}/recommerce/forsale/search?${new URLSearchParams({ q })}`;

export function parseToriListings(
  html: string,
  model: Model & { family?: string },
  now = new Date(),
  site: RecommerceSite = 'tori',
): LiveListing[] {
  const { name, host, country } = RECOMMERCE_SITES[site];
  const script = html.match(/<script\b(?=[^>]*\bid=["']seoStructuredData["'])[^>]*>([\s\S]*?)<\/script>/i);
  if (!script)
    throw new CollectorError(
      'layout_changed',
      `${name} returned no recognized structured listing data. Nothing was imported.`,
    );
  if (!script[1].trim()) return []; // The block is empty when a search has no results.
  let page: ItemList;
  try {
    page = JSON.parse(script[1]);
  } catch {
    throw new CollectorError('layout_changed', `${name} structured data could not be parsed.`);
  }
  const entries = page?.mainEntity?.itemListElement;
  if (!Array.isArray(entries)) throw new CollectorError('layout_changed', `${name} listing format changed.`);
  const result: LiveListing[] = [];
  for (const entry of entries.slice(0, 100)) {
    const p = entry?.item,
      o = p?.offers;
    if (!p || !o || o.availability !== 'https://schema.org/InStock') continue;
    const match = classifyMatch(p.name || '', model);
    if (!match) continue;
    let link: URL;
    try {
      link = new URL(p.url ?? '');
    } catch {
      continue;
    }
    if (
      link.protocol !== 'https:' ||
      link.hostname !== host ||
      !/^\/recommerce\/forsale\/item\/\d+$/.test(link.pathname)
    )
      continue;
    const condition = o.itemCondition || p.itemCondition;
    const candidate = collectedPrice.safeParse({
      modelId: model.id,
      sourceId: site,
      country,
      currency: o.priceCurrency,
      price: Number(o.price),
      status: soldWord.test(p.name || '') ? 'sold-asking' : 'asking',
      observedAt: now.toISOString().slice(0, 10),
      condition:
        condition === 'https://schema.org/UsedCondition'
          ? 'used'
          : condition === 'https://schema.org/NewCondition'
            ? 'new'
            : 'unknown',
      sellerType: 'unknown',
      contents: 'unknown',
      url: link.origin + link.pathname,
      title: p.name,
      collectedAt: now.toISOString(),
    });
    if (candidate.success && !result.some((r) => r.url === candidate.data.url))
      result.push({ ...candidate.data, match, image: firstImage(p.image) });
  }
  return result;
}

export function parseTori(html: string, model: Model, now = new Date()): Candidate[] {
  return exactCandidates(parseToriListings(html, model, now));
}

export async function recommerceSearch(site: RecommerceSite, q: string, model: Model & { family?: string }) {
  return parseToriListings(
    await safeFetch(recommerceSearchUrl(site, q), { headers: recommerceHeaders }),
    model,
    new Date(),
    site,
  );
}

/** Tori item pages embed the listing's last-edited time; the search page has no dates. */
export function parseToriItemDate(html: string): string | undefined {
  const iso = html.match(/\\?"edited\\?"\s*:\s*\\?"(\d{4}-\d{2}-\d{2})T/);
  if (iso) return iso[1];
  const fi = html.match(/Viimeksi muokattu(?:<!-- -->)?:\s*(?:<!-- -->)?(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  return fi ? `${fi[3]}-${fi[2].padStart(2, '0')}-${fi[1].padStart(2, '0')}` : undefined;
}

const itemDates = new Map<string, { at: number; date?: string }>();

/** Recommerce search pages have no dates; item pages embed the last-edited time. Bounded to 24 pages per refresh. */
async function addItemDates(items: LiveListing[]) {
  const queue = items
    .filter((l) => l.sourceId in RECOMMERCE_SITES && !l.listedAt && l.match !== 'similar')
    .slice(0, 24);
  const worker = async () => {
    for (let l = queue.shift(); l; l = queue.shift()) {
      const hit = itemDates.get(l.url);
      if (hit && Date.now() - hit.at < 24 * 3600_000) {
        l.listedAt = hit.date;
        continue;
      }
      try {
        const date = parseToriItemDate(await safeFetch(l.url, { headers: recommerceHeaders }));
        itemDates.set(l.url, { at: Date.now(), date });
        l.listedAt = date;
      } catch {
        /* keep undated */
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

/** Tori, FINN, Blocket and DBA in parallel (reference query, then model line); each site is its own source. */
export async function collectRecommerce(
  model: Model & { family?: string },
  queries: string[],
): Promise<CollectorResult> {
  const perSite = await Promise.all(
    (Object.keys(RECOMMERCE_SITES) as RecommerceSite[]).map(async (site) => {
      const found: LiveListing[] = [];
      const errors: unknown[] = [];
      for (const query of queries) {
        try {
          addListings(found, await recommerceSearch(site, query, model));
        } catch (e) {
          errors.push(e);
        }
      }
      return { site, found, errors };
    }),
  );
  const listings: LiveListing[] = [];
  const sources: SourceStatus[] = perSite.map(({ site, found, errors }) => {
    const { name } = RECOMMERCE_SITES[site];
    const searchUrl = recommerceSearchUrl(site, queries[0]);
    if (errors.length && !found.length)
      return {
        id: site,
        name,
        status: failureStatus(errors[0]),
        count: 0,
        message: errorMessage(errors[0], `${name} request failed`),
        searchUrl,
      };
    return { id: site, name, status: 'ok', count: addListings(listings, found), searchUrl };
  });
  await addItemDates(listings);
  return { listings, sources };
}
