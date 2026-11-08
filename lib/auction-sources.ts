import { baseReference, classifyMatch, collectedPrice, CollectorError, decodeEntities, failureStatus, safeFetch, type LiveListing, type SourceStatus } from './collectors';
import type { Model } from './market';

const headers = { 'User-Agent': 'WatchLedger/1.0 (watch price tracker)', Accept: 'text/html' };
const plain = (s: string) => decodeEntities(s.replace(/<br\s*\/?\s*>/gi, '; ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const multipleWatches = /\b(?:set|collection|group|lot) of (?:\d+|two|three|four|five|six|seven|eight|nine|ten)\b|\bpair of (?:\w+\s+){0,3}watches\b/i;
const dateOf = (s: string, now: Date) => {
  const date = new Date(s);
  return Number.isFinite(+date) && date.getUTCFullYear() >= 1900 && +date <= +now ? date.toISOString().slice(0, 10) : null;
};

export function parseAntiquorum(html: string, model: Model, now = new Date()): LiveListing[] {
  if (!/id="products"/.test(html)) throw new CollectorError('layout_changed', 'Antiquorum did not return its public lot search.');
  const listings: LiveListing[] = [];
  for (const card of html.split(/<div class="shadow mt-4">/).slice(1, 31)) {
    const field = (name: string) => plain(card.match(new RegExp(`<strong>${name}<\\/strong>([\\s\\S]*?)<\\/p>`, 'i'))?.[1] || '');
    const title = plain(card.match(/<span itemprop="name" content="([^"]*)"/i)?.[1] || '');
    const details = `${field('Brand')} Ref. ${field('Reference')} ${plain(card.match(/property="schema:description" content="([^"]*)"/i)?.[1] || '')}`;
    if (multipleWatches.test(`${title} ${details}`)) continue;
    const match = classifyMatch(title, model, details);
    const sold = plain(card.match(/class="N_lots_price[^>]*>([\s\S]*?)<\/p>/)?.[1] || '').match(/^Sold:\s*([A-Z]{3})\s+([\d,]+(?:\.\d{1,2})?)$/);
    const dateText = plain(card.match(/class="ml-auto p-2 bd-highlight">([^<]*)</)?.[1] || '').match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:-(\d{1,2})(?:st|nd|rd|th)?)?,?\s+(\d{4})\b/);
    const date = dateText && dateOf(`${dateText[1]} ${dateText[3] || dateText[2]}, ${dateText[4]} 00:00:00 GMT`, now);
    const path = card.match(/href="(\/en\/lots\/[a-z0-9-]+)(?:\?[^"<>]*)?"/i)?.[1];
    if (!match || !sold || !date || !path) continue; // An estimate, missing outcome or current bid never establishes a sale.
    const candidate = collectedPrice.safeParse({ modelId: model.id, sourceId: 'antiquorum', country: 'UNKNOWN', currency: sold[1], price: Number(sold[2].replaceAll(',', '')), status: 'confirmed-sale', observedAt: date, condition: 'unknown', sellerType: 'unknown', contents: 'unknown', url: `https://catalog.antiquorum.swiss${path}`, title: `${title} · Antiquorum reported result (fee basis unspecified)`.slice(0, 500), collectedAt: now.toISOString() });
    const image = card.match(/<img[^>]*src="(https:\/\/images-catalog\.antiquorum\.swiss\/[^"<>]+)"/)?.[1];
    if (candidate.success && !listings.some(l => l.url === candidate.data.url)) listings.push({ ...candidate.data, match, matchDetails: details, listedAt: date, image });
  }
  return listings;
}

export function christiesCatalogue(html: string): { lots: any[]; pages: number } {
  const raw = html.match(/window\.chrComponents\s*=\s*(\{[^\n]+\});/)?.[1];
  let data: any;
  try { data = raw && JSON.parse(raw)?.lots?.data; } catch { /* Report a changed public page, never evaluate its scripts. */ }
  if (!Array.isArray(data?.lots)) throw new CollectorError('layout_changed', 'Christie’s did not return its public catalogue data.');
  return { lots: data.lots, pages: Number(data.total_pages) || 1 };
}

export function parseChristies(lots: any[], model: Model, now = new Date()): LiveListing[] {
  const listings: LiveListing[] = [];
  for (const lot of lots.slice(0, 400)) {
    const title = plain([lot.title_primary_txt, lot.title_secondary_txt].filter(v => typeof v === 'string').join(' '));
    const details = typeof lot.description_txt === 'string' ? plain(lot.description_txt).slice(0, 2000) : '';
    if (multipleWatches.test(`${title} ${details}`)) continue;
    const match = classifyMatch(title, model, details), date = typeof lot.end_date === 'string' ? dateOf(lot.end_date, now) : null;
    const amount = typeof lot.price_realised === 'string' || typeof lot.price_realised === 'number' ? Number(lot.price_realised) : NaN;
    const currency = typeof lot.price_realised_txt === 'string' ? lot.price_realised_txt.match(/^([A-Z]{3})\s/)?.[1] : undefined;
    if (!match || !date || !currency || !Number.isFinite(amount) || amount <= 0 || lot.is_unsold || lot.lot_withdrawn || lot.is_open_for_bidding) continue;
    let url: URL;
    try { url = new URL(lot.url, 'https://onlineonly.christies.com'); } catch { continue; }
    if (url.origin !== 'https://onlineonly.christies.com' || !/^\/s\/[a-z0-9-]+\/[a-z0-9-]+\/\d+$/.test(url.pathname)) continue;
    const candidate = collectedPrice.safeParse({ modelId: model.id, sourceId: 'christies', country: 'UNKNOWN', currency, price: amount, status: 'confirmed-sale', observedAt: date, condition: 'unknown', sellerType: 'unknown', contents: 'unknown', url: url.origin + url.pathname, title: `${title} · Christie’s price realised (buyer’s premium included)`.slice(0, 500), collectedAt: now.toISOString() });
    const image = lot.image?.image_src;
    if (candidate.success && !listings.some(l => l.url === candidate.data.url)) listings.push({ ...candidate.data, match, matchDetails: details, listedAt: date, image: typeof image === 'string' && image.startsWith('https://') ? image : undefined });
  }
  return listings;
}

// shortcut: two public Geneva catalogues, up to four cumulative pages each; expand the catalogue list when global discovery is available.
export const CHRISTIES_CATALOGUES = [
  'https://onlineonly.christies.com/s/watches-online-geneva-edit/lots/3914',
  'https://onlineonly.christies.com/s/watches-online-geneva-edit/lots/3335',
];

export async function collectAuctionSources(model: Model, fetcher: typeof fetch = fetch, now = new Date()) {
  const antiquorumUrl = `https://catalog.antiquorum.swiss/en/lots?${new URLSearchParams({ q: `${model.brand} ${baseReference(model.reference)}` })}`;
  const jobs = [
    { id: 'antiquorum', name: 'Antiquorum', searchUrl: antiquorumUrl, run: async () => ({ listings: parseAntiquorum(await safeFetch(antiquorumUrl, { headers }, fetcher), model, now), message: 'Published sold results from the first search page. Fee basis is source reported, not normalized to hammer.' }) },
    { id: 'christies', name: 'Christie’s', searchUrl: CHRISTIES_CATALOGUES[0], run: async () => {
      const pages = await Promise.allSettled(CHRISTIES_CATALOGUES.map(async url => {
        const first = christiesCatalogue(await safeFetch(url, { headers }, fetcher));
        const page = Math.min(first.pages, 4);
        return parseChristies(page > 1 ? christiesCatalogue(await safeFetch(`${url}?page=${page}`, { headers }, fetcher)).lots : first.lots, model, now);
      }));
      const listings = pages.flatMap(p => p.status === 'fulfilled' ? p.value : []);
      const failed = pages.filter(p => p.status === 'rejected');
      if (failed.length === pages.length) throw (failed[0] as PromiseRejectedResult).reason;
      return { listings, failed: failed.length, message: `Published prices realised, including buyer’s premium. Limited to the Geneva online catalogues of December 2023 and October 2026.${failed.length ? ` ${failed.length} catalogue unavailable.` : ''}` };
    } },
  ];
  const results = await Promise.all(jobs.map(async job => {
    try {
      const result = await job.run();
      return { listings: result.listings, source: { id: job.id, name: job.name, status: 'failed' in result && result.failed ? 'error' : 'ok', count: result.listings.length, searchUrl: job.searchUrl, message: result.message } as SourceStatus };
    } catch (e) {
      return { listings: [] as LiveListing[], source: { id: job.id, name: job.name, status: failureStatus(e), count: 0, searchUrl: job.searchUrl, message: e instanceof Error ? e.message : 'Auction source unavailable' } as SourceStatus };
    }
  }));
  return { listings: results.flatMap(r => r.listings), sources: results.map(r => r.source) };
}
