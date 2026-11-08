import type { Model } from '../../../market';
import { CollectorError } from '../../core/errors';
import { safeFetch } from '../../core/http';
import { collectedPrice, type LiveListing } from '../../core/listing';
import { decodeEntities } from '../../core/text';
import { classifyMatch, exactMatch } from '../../matching/classify';
import { baseReference } from '../../matching/reference';
import { headers } from './shared';

const plain = (html: string) =>
  decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

export function phillipsResults(html: string) {
  if (!/id="search-page"/.test(html))
    throw new CollectorError('layout_changed', 'Phillips did not return its public search results.');
  return [...html.matchAll(/<li\b[^>]*class="[^"]*search-result-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g)].flatMap(
    ([, card]) => {
      if (!/class="sold"/.test(card)) return []; // Estimates and current bids are not sale prices.
      const href = card.match(/href=['"](\/detail\/[^'"?]+)(?:\?[^'"]*)?['"]/)?.[1];
      const dates = plain(card).match(/\b\d{1,2} [A-Za-z]+ \d{4}\b/g);
      const date = dates?.at(-1);
      const parsed = date ? new Date(`${date} 12:00:00 GMT`) : null;
      if (!href || !/^\/detail\/[a-z0-9-]+\/\d+$/i.test(href) || !parsed || !Number.isFinite(+parsed)) return [];
      return [
        {
          url: `https://www.phillips.com${href}`,
          date: parsed.toISOString().slice(0, 10),
          image: decodeEntities(card.match(/data-image="([^"]+)"/)?.[1] || ''),
        },
      ];
    },
  );
}

export function parsePhillipsSale(
  html: string,
  result: ReturnType<typeof phillipsResults>[number],
  model: Model,
  now = new Date(),
): LiveListing | null {
  const field = (label: string) => {
    const value = html.match(
      new RegExp(`>${label}<\\/span>[\\s\\S]{0,200}?class="seldon-detail__value"[^>]*>([\\s\\S]*?)<\\/div>`),
    )?.[1];
    return value ? plain(value) : '';
  };
  const brand = field('Manufacturer'),
    reference = field('Reference No'),
    name = field('Model Name');
  if (
    !reference ||
    !exactMatch(`${brand} ${baseReference(reference)}`, { ...model, reference: baseReference(model.reference) }) ||
    result.date > now.toISOString().slice(0, 10)
  )
    return null;
  const sold = field('Sold For');
  const amount = sold.match(/^(HK\$|US\$|\$|CHF|€|£|EUR|USD|GBP|HKD)\s*([\d,]+(?:\.\d{1,2})?)$/);
  if (!amount) return null;
  const currency =
    ({ HK$: 'HKD', US$: 'USD', $: 'USD', '€': 'EUR', '£': 'GBP' } as Record<string, string>)[amount[1]] || amount[1];
  const candidate = collectedPrice.safeParse({
    modelId: model.id,
    sourceId: 'phillips',
    country: 'UNKNOWN',
    currency,
    price: Number(amount[2].replaceAll(',', '')),
    status: 'confirmed-sale',
    observedAt: result.date,
    condition: 'unknown',
    sellerType: 'unknown',
    contents: 'unknown',
    url: result.url,
    title: `${brand} ${name} Ref. ${reference} · Phillips reported auction result`.slice(0, 500),
    collectedAt: now.toISOString(),
  });
  return candidate.success
    ? {
        ...candidate.data,
        match: classifyMatch(`${brand} ${name} Ref. ${reference} Dial: ${field('Dial')}`, model) ?? 'similar',
        listedAt: result.date,
        image: result.image || undefined,
      }
    : null;
}

export async function collectPhillips(model: Model) {
  const searchUrl = `https://www.phillips.com/search?${new URLSearchParams({ search: baseReference(model.reference) })}`;
  // shortcut: first search page, at most eight sold lots; add pagination when coverage needs it.
  const results = phillipsResults(await safeFetch(searchUrl, { headers })).slice(0, 8);
  const fetched = await Promise.allSettled(
    results.map(async (r) => parsePhillipsSale(await safeFetch(r.url, { headers }), r, model)),
  );
  const listings = fetched.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));
  const failed = fetched.filter((r) => r.status === 'rejected').length;
  return {
    listings,
    source: {
      id: 'phillips',
      name: 'Phillips auctions',
      status: failed ? ('error' as const) : ('ok' as const),
      count: listings.length,
      searchUrl,
      message: `${listings.length} auction results (${listings.filter((l) => l.match === 'exact').length} complete-reference matches). Fees may differ from private-sale prices.${failed ? ` ${failed} lot pages could not be checked.` : ''}`,
    },
  };
}
