import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { getDb } from '../../../../db';
import { records } from '../../../../db/schema';
import { findCatalogModel } from '../../../../lib/catalog';
import { fetchLiveListings, forumItemsNeedingPost, matchForumItems, parseForumRss, safeFetch, WATCHUSEEK_FEED, type ForumItem } from '../../../../lib/collectors';

const schema = z.object({ modelId: z.string().min(1).max(160), refresh: z.enum(['0', '1']).default('0') });
const TTL = 20 * 60_000;
// Per-isolate cache: one marketplace lookup per watch every 20 minutes, shared by all viewers.
const cache = new Map<string, { at: number; body: unknown }>();
const userHits = new Map<string, number[]>();
// Last good Reddit results per watch, reused while Reddit rate-limits the public feed.
const redditLast = new Map<string, { at: number; listings: unknown[] }>();
const REDDIT_REUSE = 6 * 3600_000;
// WatchUSeek has no search we may use, so new threads from its sale-forum RSS feed are archived (at most every 30 min)
// in the records table under a system owner, and each watch page matches against the whole archive.
const FEED_OWNER = '__feed__', FEED_KIND = 'feed:watchuseek';
let wusCheckedAt = 0;
async function watchuseekArchive(): Promise<{ items: ForumItem[]; error?: string }> {
  const db = getDb();
  let error: string | undefined;
  if (Date.now() - wusCheckedAt > 30 * 60_000) {
    wusCheckedAt = Date.now();
    try {
      const items = parseForumRss(await safeFetch(WATCHUSEEK_FEED, { headers: { 'User-Agent': 'WatchLedger/1.0 (personal watch price tracker)', Accept: 'application/rss+xml' } }));
      for (const it of items)
        await db.insert(records).values({ id: `wus:${it.id}`, owner: FEED_OWNER, kind: FEED_KIND, payload: JSON.stringify(it) }).onConflictDoUpdate({ target: records.id, set: { payload: JSON.stringify(it) } });
    } catch (e) {
      error = e instanceof Error ? e.message : 'WatchUSeek feed unavailable';
    }
  }
  const rows = await db.select().from(records).where(eq(records.owner, FEED_OWNER));
  const items = rows.filter((r) => r.kind === FEED_KIND).map((r) => JSON.parse(r.payload) as ForumItem);
  return { items, error };
}
let lastRedditCall = 0;

export async function GET(req: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Please sign in.' }, { status: 401 });
  const input = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!input.success) return Response.json({ error: 'Invalid watch.' }, { status: 400 });
  const { modelId, refresh } = input.data;

  let model = findCatalogModel(modelId) as any;
  if (!model) {
    const rows = await getDb().select().from(records).where(eq(records.owner, user.userId));
    const custom = rows.find((r) => r.kind === 'model' && r.id === modelId);
    if (custom) model = { ...JSON.parse(custom.payload), id: custom.id };
  }
  if (!model) return Response.json({ error: 'Watch model not found.' }, { status: 404 });

  const hit = cache.get(modelId);
  if (hit && refresh === '0' && Date.now() - hit.at < ((hit.body as any).partial ? 2 * 60_000 : TTL)) return Response.json(hit.body, { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'hit' } });

  const now = Date.now();
  const recent = (userHits.get(user.userId) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 12) return Response.json({ error: 'Too many live lookups. Try again in a minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  userHits.set(user.userId, [...recent, now]);

  // Reddit's public feed allows about one request a minute: reuse results for 6 hours and space calls 10 s apart.
  const recentReddit = redditLast.get(modelId);
  const skipReddit = recentReddit && refresh === '0' && Date.now() - recentReddit.at < REDDIT_REUSE ? 'reuse' : Date.now() - lastRedditCall < 10_000 ? 'Reddit checks are spaced out to respect its rate limit. Refresh in a few seconds.' : undefined;
  if (!skipReddit) lastRedditCall = Date.now();
  const { listings, sources } = await fetchLiveListings(model, env as any, undefined, { skipReddit });
  const wus = await watchuseekArchive();
  const wusMatches = matchForumItems(wus.items, model, 'watchuseek');
  // Thread pages sit behind a JavaScript bot check, so threads whose feed excerpt has no price are only linked.
  const threads = forumItemsNeedingPost(wus.items, model).map((it) => ({ title: it.title, url: it.url, date: it.date, source: 'WatchUSeek' }));
  listings.push(...wusMatches);
  sources.push({
    id: 'watchuseek', name: 'WatchUSeek', count: wusMatches.length,
    status: wus.error && !wus.items.length ? 'error' : 'ok',
    message: wus.error ? `Feed check failed (${wus.error}); using ${wus.items.length} archived threads.` : `Matched against ${wus.items.length} archived sale threads${wus.items.length ? ` since ${wus.items.map((i) => i.date).sort()[0]}` : ''}. The archive grows as new threads appear.`,
    searchUrl: 'https://www.watchuseek.com/forums/watches-private-sellers-and-sponsors.29/',
  } as (typeof sources)[number]);
  const reddit = sources.find((x) => x.id === 'reddit');
  if (reddit?.status === 'ok') redditLast.set(modelId, { at: Date.now(), listings: listings.filter((l) => l.sourceId === 'reddit') });
  else if (reddit?.status === 'error') {
    const last = redditLast.get(modelId);
    if (last && Date.now() - last.at < 24 * 3600_000) {
      listings.push(...(last.listings as typeof listings));
      reddit.status = 'ok';
      reddit.count = last.listings.length;
      const mins = Math.round((Date.now() - last.at) / 60_000);
      reddit.message = skipReddit === 'reuse' ? `Checked ${mins} min ago. Refresh to check Reddit again.` : `Reddit is rate-limiting; showing results from ${mins} min ago.`;
    }
  }
  const partial = sources.some((x) => x.status === 'error');
  const body = { partial, threads, modelId, fetchedAt: new Date().toISOString(), listings, sources, note: 'Live asking prices. Exact-reference matches set the market price; similar listings are shown for context only.' };
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  cache.set(modelId, { at: Date.now(), body });
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
