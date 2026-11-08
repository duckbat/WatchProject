import type { Model } from '../../market';
import { CollectorError } from '../core/errors';
import { collectedPrice, type LiveListing } from '../core/listing';
import { extractPrice } from '../core/price';
import { decodeEntities } from '../core/text';
import { classifyMatch, exactMatch, referenceMatch } from '../matching/classify';
import { soldWord } from '../matching/keywords';

/** One thread from a forum's public RSS feed (XenForo: WatchUSeek, Kellofoorumi, Klocksnack, Tidssonen). */
export type ForumItem = { id: string; title: string; url: string; date: string; text: string };

export function parseForumRss(xml: string, host = 'www.watchuseek.com'): ForumItem[] {
  if (!/<rss[\s>]/.test(xml)) throw new CollectorError('layout_changed', 'The forum did not return an RSS feed.');
  const out: ForumItem[] = [];
  for (const item of (xml.match(/<item>[\s\S]*?<\/item>/g) || []).slice(0, 100)) {
    const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const link = item.match(/<link>([^<]+)<\/link>/)?.[1]?.trim();
    const pub = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
    if (!title || !link || !pub) continue;
    let u: URL;
    try {
      u = new URL(decodeEntities(link));
    } catch {
      continue;
    }
    if (u.protocol !== 'https:' || u.hostname !== host || !/^(?:\/forum)?\/threads\/[^/]*\.(\d+)\/?$/.test(u.pathname))
      continue;
    const when = new Date(pub);
    if (!Number.isFinite(+when)) continue;
    const raw =
      item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1] ||
      item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ||
      '';
    const text = decodeEntities(raw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
      .replace(/[ \t]+/g, ' ')
      .trim()
      .slice(0, 2000);
    out.push({
      id: u.pathname.match(/\.(\d+)\/?$/)![1],
      title: decodeEntities(title).trim().slice(0, 300),
      url: u.origin + u.pathname,
      date: when.toISOString().slice(0, 10),
      text,
    });
  }
  return out;
}

/** Forum threads that name this watch, with the first price in the title or post. */
export function matchForumItems(
  items: ForumItem[],
  model: Model & { family?: string },
  sourceId: string,
  local: { country?: string; currency?: string } = {},
): LiveListing[] {
  const result: LiveListing[] = [];
  for (const it of items) {
    const match = classifyMatch(it.title, model, it.text);
    if (!match) continue;
    const priced = extractPrice(it.title, local.currency) || extractPrice(it.text, local.currency);
    if (!priced) continue;
    const sold = soldWord.test(it.title);
    const c = collectedPrice.safeParse({
      modelId: model.id,
      sourceId,
      country: local.country || (/\b(conus|usa|u\.s\.)\b/i.test(`${it.title} ${it.text}`) ? 'US' : 'UNKNOWN'),
      currency: priced.currency,
      price: priced.price,
      status: sold ? 'sold-asking' : 'asking',
      observedAt: it.date,
      condition: /\b(new|unworn|bnib)\b/i.test(it.title) ? 'new' : 'unknown',
      sellerType: /\b(dealer|sponsor)\b/i.test(it.text) ? 'dealer' : 'private',
      contents: 'unknown',
      url: it.url,
      title: it.title,
      collectedAt: new Date().toISOString(),
    });
    if (c.success && !result.some((r) => r.url === c.data.url)) result.push({ ...c.data, match, listedAt: it.date });
  }
  return result;
}

/** Threads naming this exact reference whose feed excerpt has no price (shown as links only). */
export function forumItemsNeedingPost(items: ForumItem[], model: Model): ForumItem[] {
  return items.filter(
    (it) =>
      (exactMatch(it.title, model, it.text) || referenceMatch(it.title, model, it.text)) &&
      !extractPrice(it.title) &&
      !extractPrice(it.text),
  );
}

export const WATCHUSEEK_FEED = 'https://www.watchuseek.com/forums/watches-private-sellers-and-sponsors.29/index.rss';

/** Public sale-section RSS feeds, archived every 30 minutes at most (Tidssonen asks for 60 s between requests, Klocksnack 5 s). */
export const FORUM_FEEDS = [
  { id: 'watchuseek', name: 'WatchUSeek', url: WATCHUSEEK_FEED, host: 'www.watchuseek.com', prefix: 'wus' },
  {
    id: 'kellofoorumi',
    name: 'Kellofoorumi',
    url: 'https://kellofoorumi.fi/forums/yksityisten-ilmoitukset.8/index.rss',
    host: 'kellofoorumi.fi',
    prefix: 'kf',
    country: 'FI',
    currency: 'EUR',
  },
  {
    id: 'klocksnack',
    name: 'Klocksnack',
    url: 'https://klocksnack.se/forums/handla-s%C3%A4ljes-bytes-k%C3%B6pes.11/index.rss',
    host: 'klocksnack.se',
    prefix: 'ks',
    country: 'SE',
    currency: 'SEK',
  },
  {
    id: 'tidssonen',
    name: 'Tidssonen',
    url: 'https://www.tidssonen.no/forum/forums/marked-%E2%80%93-klokker.9/index.rss',
    host: 'www.tidssonen.no',
    prefix: 'tds',
    country: 'NO',
    currency: 'NOK',
  },
] as const;

export type ForumFeed = (typeof FORUM_FEEDS)[number];
