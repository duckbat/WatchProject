import type { Model } from '../../market';
import { relativeDate } from '../core/dates';
import { CollectorError, failureStatus } from '../core/errors';
import { safeFetch } from '../core/http';
import { collectedPrice, type LiveListing } from '../core/listing';
import { type CollectorResult, errorMessage } from '../core/result';
import { decodeEntities } from '../core/text';
import { classifyMatch } from '../matching/classify';
import { soldWord } from '../matching/keywords';

/** WatchRecon indexes the sale sections of ~15 watch forums (r/Watchexchange, r/Watch_Swap, TimeZone, ...) with prices. */
const watchReconSources: [RegExp, string][] = [
  [/^r\/watch_?exchange$/i, 'reddit'],
  [/^r\/watch_swap$/i, 'reddit'],
  [/^timezone$/i, 'timezone'],
  [/^watchuseek$/i, 'watchuseek'],
];

const symbolCurrency: Record<string, string> = { $: 'USD', '£': 'GBP', '€': 'EUR', '¥': 'JPY', chf: 'CHF', c$: 'CAD' };

export function parseWatchRecon(html: string, model: Model & { family?: string }, now = new Date()): LiveListing[] {
  if (!/class="queryResultContainer"/.test(html))
    throw new CollectorError('layout_changed', 'WatchRecon did not return its search results.');
  const result: LiveListing[] = [];
  for (const card of html.split(/<div class="galleryItemContainer\b/).slice(1, 101)) {
    const link = card.match(/<a href="([^"]+)" class="listingLink"[^>]*title="([^"]*)"/);
    if (!link) continue;
    // The brand sits in its own field; titles often omit it ("Datejust 36 ... Ref. 126200").
    const title = decodeEntities(decodeEntities(link[2])).trim(),
      brand = decodeEntities(card.match(/class="brandInfo"><a[^>]*>([^<]*)</)?.[1] || '');
    const match = classifyMatch(title, model, brand);
    if (!match) continue;
    let url: URL;
    try {
      url = new URL(decodeEntities(link[1]));
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) continue;
    url.protocol = 'https:';
    const priceText = decodeEntities(card.match(/class="priceInfo">([^<]*)</)?.[1] || '').replace(/\s/g, '');
    const pm = priceText.match(/^(\$|£|€|¥|CHF|C\$)([\d,]+(?:\.\d{1,2})?)$/i);
    if (!pm) continue;
    const tags = [...card.matchAll(/class="tag">([^<]*)</g)].map((t) => decodeEntities(t[1]).toLowerCase());
    if (tags.some((t) => /\b(wtb|want to buy)\b/.test(t))) continue;
    const sourceText = decodeEntities(card.match(/class="sourceInfo">on&nbsp;([^<]*)</)?.[1] || '').trim();
    const sourceId = watchReconSources.find(([re]) => re.test(sourceText))?.[1] || 'watchrecon';
    const date =
      relativeDate(decodeEntities(card.match(/class="postDateInfo">([^<]*)</)?.[1] || ''), now) ||
      now.toISOString().slice(0, 10);
    const sold = tags.some((t) => /\b(sold|traded)\b/.test(t)) || soldWord.test(title);
    const location = decodeEntities(card.match(/class="locationInfo">([^<]*)</)?.[1] || '').trim();
    const country =
      tags.includes('conus') || /\b(usa|united states|conus)\b/i.test(location)
        ? 'US'
        : /\b(uk|united kingdom|england)\b/i.test(location)
          ? 'GB'
          : 'UNKNOWN';
    const image = card.match(/<img class="thumb" src="(image\.php\?[^"]+)"/)?.[1];
    const c = collectedPrice.safeParse({
      modelId: model.id,
      sourceId,
      country,
      currency: symbolCurrency[pm[1].toLowerCase()],
      price: Number(pm[2].replaceAll(',', '')),
      status: sold ? 'sold-asking' : 'asking',
      observedAt: date,
      condition: tags.some((t) => /\b(new|unworn|bnib)\b/.test(t))
        ? 'new'
        : tags.some((t) => /mint|used|pre-?owned/.test(t))
          ? 'used'
          : 'unknown',
      sellerType: 'private',
      contents: 'unknown',
      url: url.href,
      title: title.slice(0, 500),
      collectedAt: now.toISOString(),
    });
    if (c.success && !result.some((r) => r.url === c.data.url))
      result.push({
        ...c.data,
        match,
        listedAt: date,
        image: image ? `https://www.watchrecon.com/${decodeEntities(image)}` : undefined,
      });
  }
  return result;
}

export const watchReconSearchUrl = (q: string) => `https://www.watchrecon.com/?${new URLSearchParams({ query: q })}`;

const NAME = 'WatchRecon (sale forums)';

export async function collectWatchRecon(model: Model & { family?: string }, query: string): Promise<CollectorResult> {
  const searchUrl = watchReconSearchUrl(query);
  try {
    const html = await safeFetch(searchUrl, {
      headers: { 'User-Agent': 'WatchLedger/1.0 (personal watch price tracker)', Accept: 'text/html' },
    });
    const listings = parseWatchRecon(html, model);
    return {
      listings,
      sources: [
        {
          id: 'watchrecon',
          name: NAME,
          status: 'ok',
          count: listings.length,
          searchUrl,
          message:
            'Sale posts from r/Watchexchange, r/Watch_Swap, TimeZone and other forums, newest ~2 weeks per check. Posts are archived, so history grows over time.',
        },
      ],
    };
  } catch (e) {
    return {
      listings: [],
      sources: [
        {
          id: 'watchrecon',
          name: NAME,
          status: failureStatus(e),
          count: 0,
          message: errorMessage(e, 'WatchRecon request failed'),
          searchUrl,
        },
      ],
    };
  }
}
