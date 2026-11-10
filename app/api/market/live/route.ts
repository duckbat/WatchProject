import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { getDb } from '../../../../db';
import { records } from '../../../../db/schema';
import { findCatalogModel } from '../../../../lib/catalog';
import { MARKET_OWNER, similarListings, watchMarket } from '../../../../lib/market-archive/watch-market';

const schema = z.object({ modelId: z.string().min(1).max(160), refresh: z.enum(['0', '1']).default('0'), similar: z.enum(['0', '1']).default('0') });

export async function GET(req: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Please sign in.' }, { status: 401 });
  const input = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!input.success) return Response.json({ error: 'Invalid watch.' }, { status: 400 });
  const catalogModel = findCatalogModel(input.data.modelId);
  let model = catalogModel;
  if (!model) {
    const custom = await getDb().select().from(records).where(and(eq(records.owner, user.userId), eq(records.kind, 'model'), eq(records.id, input.data.modelId))).get();
    if (custom) model = { ...JSON.parse(custom.payload), id: custom.id };
  }
  if (!model) return Response.json({ error: 'Watch model not found.' }, { status: 404 });
  const owner = catalogModel ? MARKET_OWNER : user.userId;
  // Other models stored for this watch, requested by "Show similar listings" (not part of the page's first load).
  if (input.data.similar === '1') return Response.json({ listings: await similarListings(model, owner) }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    // An older archive is shown at once and refreshed in the background; a Refresh click waits for new data.
    const data = await watchMarket(model, owner, input.data.refresh === '1', { revalidateInBackground: true });
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Could not refresh listings. Please retry shortly.' }, { status: 503 });
  }
}
