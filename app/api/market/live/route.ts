import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { getDb } from '../../../../db';
import { records } from '../../../../db/schema';
import { findCatalogModel } from '../../../../lib/catalog';
import { fetchLiveListings } from '../../../../lib/collectors';

const schema = z.object({ modelId: z.string().min(1).max(160), refresh: z.enum(['0', '1']).default('0') });
const TTL = 20 * 60_000;
// Per-isolate cache: one marketplace lookup per watch every 20 minutes, shared by all viewers.
const cache = new Map<string, { at: number; body: unknown }>();
const userHits = new Map<string, number[]>();

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
  if (hit && refresh === '0' && Date.now() - hit.at < TTL) return Response.json(hit.body, { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'hit' } });

  const now = Date.now();
  const recent = (userHits.get(user.userId) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 12) return Response.json({ error: 'Too many live lookups. Try again in a minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  userHits.set(user.userId, [...recent, now]);

  const { listings, sources } = await fetchLiveListings(model, env as any);
  const body = { modelId, fetchedAt: new Date().toISOString(), listings, sources, note: 'Live asking prices. Exact-reference matches set the market price; similar listings are shown for context only.' };
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  cache.set(modelId, { at: Date.now(), body });
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
