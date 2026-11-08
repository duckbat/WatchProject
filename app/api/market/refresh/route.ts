import { and, eq } from 'drizzle-orm';
import { getDb } from '../../../../db';
import { records } from '../../../../db/schema';
import { findCatalogModel } from '../../../../lib/catalog';
import { currentArchiveMatches, MARKET_OWNER, watchMarket } from '../../../../lib/watch-market';

// The owner-only Sites gateway authenticates service requests. This updates public catalog data only.
export async function POST(req: Request) {
  const requested = new URL(req.url).searchParams.get('modelId');
  if (requested) {
    const model = requested.length <= 160 ? findCatalogModel(requested) : null;
    if (!model) return Response.json({ error: 'Choose a public catalog reference.' }, { status: 400 });
    try {
      const result = await watchMarket(model);
      return Response.json({ refreshed: 1, modelId: model.id, count: result.listings.length, partial: result.partial });
    } catch { return Response.json({ error: 'Collection failed; the previous archive is retained.' }, { status: 503 }); }
  }
  const rows = await getDb().select().from(records).where(and(eq(records.owner, MARKET_OWNER), eq(records.kind, 'market-history')));
  const due = rows.map((r) => JSON.parse(r.payload)).filter((r) => Date.now() - +new Date(r.fetchedAt) >= 6 * 3_600_000).sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt));
  const next = due.find((r) => findCatalogModel(r.modelId));
  if (!next) return Response.json({ refreshed: 0, remaining: 0 });
  try {
    const result = await watchMarket(findCatalogModel(next.modelId)!, MARKET_OWNER, true);
    return Response.json({ refreshed: 1, modelId: next.modelId, count: result.listings.length, remaining: due.length - 1, partial: result.partial });
  } catch { return Response.json({ error: 'Collection failed; the previous archive is retained.' }, { status: 503 }); }
}

export async function GET(req: Request) {
  const modelId = new URL(req.url).searchParams.get('modelId') || '';
  if (modelId.length > 160 || !findCatalogModel(modelId)) return Response.json({ error: 'Choose a public catalog reference.' }, { status: 400 });
  const row = await getDb().select().from(records).where(and(eq(records.owner, MARKET_OWNER), eq(records.id, `market:${MARKET_OWNER}:${modelId}`))).get();
  return row ? Response.json(currentArchiveMatches(JSON.parse(row.payload), findCatalogModel(modelId)!), { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: 'Reference has not been collected yet.' }, { status: 404 });
}
