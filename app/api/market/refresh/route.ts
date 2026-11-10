import { findCatalogModel } from '../../../../lib/catalog';
import { readMarketArchive, watchMarket } from '../../../../lib/market-archive/watch-market';
import { runScheduledRefresh } from '../../../../lib/market-archive/scheduled-refresh';

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
  // The same plan as the cron trigger: popular Rolexes first (with eBay), then other viewed watches, most overdue first.
  const { refreshed, remaining } = await runScheduledRefresh(findCatalogModel, 1);
  const [job] = refreshed;
  if (!job) return Response.json({ refreshed: 0, remaining: 0 });
  if ('error' in job) return Response.json({ error: job.error, modelId: job.modelId }, { status: 503 });
  return Response.json({ refreshed: 1, modelId: job.modelId, reason: job.reason, ebay: job.ebay, count: job.count, remaining, partial: job.partial });
}

export async function GET(req: Request) {
  const modelId = new URL(req.url).searchParams.get('modelId') || '';
  if (modelId.length > 160 || !findCatalogModel(modelId)) return Response.json({ error: 'Choose a public catalog reference.' }, { status: 400 });
  const archive = await readMarketArchive(findCatalogModel(modelId)!);
  return archive ? Response.json(archive, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: 'Reference has not been collected yet.' }, { status: 404 });
}
