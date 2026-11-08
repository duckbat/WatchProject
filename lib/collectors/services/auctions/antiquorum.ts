import type { Model } from '../../../market';
import { CollectorError } from '../../core/errors';
import { safeFetch } from '../../core/http';
import { collectedPrice, type LiveListing } from '../../core/listing';
import { classifyMatch } from '../../matching/classify';
import { baseReference } from '../../matching/reference';
import { type AuctionHouse, dateOf, headers, multipleWatches, plain } from './shared';

export function parseAntiquorum(html: string, model: Model, now = new Date()): LiveListing[] {
  if (!/id="products"/.test(html))
    throw new CollectorError('layout_changed', 'Antiquorum did not return its public lot search.');
  const listings: LiveListing[] = [];
  for (const card of html.split(/<div class="shadow mt-4">/).slice(1, 31)) {
    const field = (name: string) =>
      plain(card.match(new RegExp(`<strong>${name}<\\/strong>([\\s\\S]*?)<\\/p>`, 'i'))?.[1] || '');
    const title = plain(card.match(/<span itemprop="name" content="([^"]*)"/i)?.[1] || '');
    const details = `${field('Brand')} Ref. ${field('Reference')} ${plain(card.match(/property="schema:description" content="([^"]*)"/i)?.[1] || '')}`;
    if (multipleWatches.test(`${title} ${details}`)) continue;
    const match = classifyMatch(title, model, details);
    const sold = plain(card.match(/class="N_lots_price[^>]*>([\s\S]*?)<\/p>/)?.[1] || '').match(
      /^Sold:\s*([A-Z]{3})\s+([\d,]+(?:\.\d{1,2})?)$/,
    );
    const dateText = plain(card.match(/class="ml-auto p-2 bd-highlight">([^<]*)</)?.[1] || '').match(
      /([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:-(\d{1,2})(?:st|nd|rd|th)?)?,?\s+(\d{4})\b/,
    );
    const date = dateText && dateOf(`${dateText[1]} ${dateText[3] || dateText[2]}, ${dateText[4]} 00:00:00 GMT`, now);
    const path = card.match(/href="(\/en\/lots\/[a-z0-9-]+)(?:\?[^"<>]*)?"/i)?.[1];
    if (!match || !sold || !date || !path) continue; // An estimate, missing outcome or current bid never establishes a sale.
    const candidate = collectedPrice.safeParse({
      modelId: model.id,
      sourceId: 'antiquorum',
      country: 'UNKNOWN',
      currency: sold[1],
      price: Number(sold[2].replaceAll(',', '')),
      status: 'confirmed-sale',
      observedAt: date,
      condition: 'unknown',
      sellerType: 'unknown',
      contents: 'unknown',
      url: `https://catalog.antiquorum.swiss${path}`,
      title: `${title} · Antiquorum reported result (fee basis unspecified)`.slice(0, 500),
      collectedAt: now.toISOString(),
    });
    const image = card.match(/<img[^>]*src="(https:\/\/images-catalog\.antiquorum\.swiss\/[^"<>]+)"/)?.[1];
    if (candidate.success && !listings.some((l) => l.url === candidate.data.url))
      listings.push({ ...candidate.data, match, matchDetails: details, listedAt: date, image });
  }
  return listings;
}

export const antiquorum: AuctionHouse = {
  id: 'antiquorum',
  name: 'Antiquorum',
  searchUrl: (model) =>
    `https://catalog.antiquorum.swiss/en/lots?${new URLSearchParams({ q: `${model.brand} ${baseReference(model.reference)}` })}`,
  run: async (model, fetcher, now) => ({
    listings: parseAntiquorum(await safeFetch(antiquorum.searchUrl(model), { headers }, fetcher), model, now),
    message:
      'Published sold results from the first search page. Fee basis is source reported, not normalized to hammer.',
  }),
};
