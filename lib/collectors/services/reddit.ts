import type { Model } from '../../market';
import { CollectorError, failureStatus } from '../core/errors';
import { safeFetch } from '../core/http';
import { collectedPrice, firstImage, type LiveListing } from '../core/listing';
import { extractPrice } from '../core/price';
import { addListings, type CollectorResult, errorMessage } from '../core/result';
import { decodeEntities } from '../core/text';
import { classifyMatch } from '../matching/classify';

/** The parts of a subreddit search response that are read. */
type RedditPost = {
  title?: string;
  selftext?: string;
  permalink?: string;
  created_utc?: number;
  link_flair_text?: string | null;
  preview?: { images?: { source?: { url?: string } }[] };
};
export type RedditSearchResponse = { data?: { children?: { data?: RedditPost }[] } };

/** r/Watchexchange search results ([WTS] posts). Post date is kept, so they form a real price history. */
export function parseRedditListings(body: RedditSearchResponse, model: Model & { family?: string }): LiveListing[] {
  const result: LiveListing[] = [];
  for (const child of (body?.data?.children || []).slice(0, 100)) {
    const p = child?.data;
    if (!p || typeof p.title !== 'string') continue;
    if (!/\[\s*wts|\[\s*wtt/i.test(p.title)) continue;
    const match = classifyMatch(p.title, model, typeof p.selftext === 'string' ? p.selftext.slice(0, 3000) : '');
    if (!match) continue;
    const priced =
      extractPrice(p.title) || extractPrice(typeof p.selftext === 'string' ? p.selftext.slice(0, 3000) : '');
    if (!priced) continue;
    if (typeof p.permalink !== 'string' || !/^\/r\/watchexchange\/comments\/[a-z0-9]+\//i.test(p.permalink)) continue;
    const created = new Date(Number(p.created_utc) * 1000);
    if (!Number.isFinite(+created)) continue;
    const sold = /sold/i.test(p.link_flair_text || '') || /\[\s*sold/i.test(p.title);
    const preview = p.preview?.images?.[0]?.source?.url;
    const image = typeof preview === 'string' ? preview.replace(/&amp;/g, '&') : undefined;
    const c = collectedPrice.safeParse({
      modelId: model.id,
      sourceId: 'reddit',
      country: /\b(conus|usa|us)\b/i.test(p.title) ? 'US' : 'UNKNOWN',
      currency: priced.currency,
      price: priced.price,
      status: sold ? 'sold-asking' : 'asking',
      observedAt: created.toISOString().slice(0, 10),
      condition: 'unknown',
      sellerType: 'private',
      contents: 'unknown',
      url: 'https://www.reddit.com' + p.permalink,
      title: p.title.slice(0, 500),
      collectedAt: new Date().toISOString(),
    });
    if (c.success && !result.some((r) => r.url === c.data.url))
      result.push({ ...c.data, match, image: firstImage(image), listedAt: c.data.observedAt });
  }
  return result;
}

export type RedditSecrets = { REDDIT_CLIENT_ID?: string; REDDIT_CLIENT_SECRET?: string };

const NAME = 'r/Watchexchange';

const userAgent = 'web:watchledger:1.0 (personal watch price tracker)';

/** r/Watchexchange through an existing API app. Without keys it is reported as blocked: posts arrive via WatchRecon. */
export async function collectReddit(
  model: Model & { family?: string },
  queries: string[],
  secrets: RedditSecrets,
): Promise<CollectorResult> {
  const searchUrl = `https://www.reddit.com/r/Watchexchange/search/?${new URLSearchParams({ q: queries[0], restrict_sr: '1', sort: 'new' })}`;
  if (!secrets.REDDIT_CLIENT_ID || !secrets.REDDIT_CLIENT_SECRET)
    return {
      listings: [],
      sources: [
        {
          id: 'reddit',
          name: NAME,
          status: 'blocked',
          count: 0,
          message:
            'Reddit closed its public feeds in November 2026 and no longer issues new API keys. r/Watchexchange posts arrive through WatchRecon instead.',
          searchUrl,
        },
      ],
    };
  try {
    const auth = JSON.parse(
      await safeFetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(secrets.REDDIT_CLIENT_ID + ':' + secrets.REDDIT_CLIENT_SECRET)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
        body: 'grant_type=client_credentials',
      }),
    );
    if (typeof auth.access_token !== 'string')
      throw new CollectorError('credentials_required', 'Reddit did not return an application token.');
    const listings: LiveListing[] = [];
    for (const query of queries) {
      const url = new URL('https://oauth.reddit.com/r/Watchexchange/search');
      url.search = new URLSearchParams({
        q: query,
        restrict_sr: '1',
        sort: 'new',
        t: 'year',
        limit: '100',
        raw_json: '1',
      }).toString();
      addListings(
        listings,
        parseRedditListings(
          JSON.parse(
            await safeFetch(url.href, {
              headers: { Authorization: `Bearer ${auth.access_token}`, 'User-Agent': userAgent },
            }),
          ),
          model,
        ),
      );
    }
    return { listings, sources: [{ id: 'reddit', name: NAME, status: 'ok', count: listings.length, searchUrl }] };
  } catch (e) {
    return {
      listings: [],
      sources: [
        {
          id: 'reddit',
          name: NAME,
          status: failureStatus(e),
          count: 0,
          message: errorMessage(e, 'Reddit request failed'),
          searchUrl,
        },
      ],
    };
  }
}
