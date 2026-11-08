import { z } from 'zod';
import { brandCounts, dialOf, findCatalogModel, mostTracked, searchCatalog, variantLabel, variantsOf, type SearchItem } from '../../../lib/catalog';
import { getFx } from '../../../lib/fx';
import { convertPrice, currencies, type Model } from '../../../lib/market';
import { marketPopularity, marketSummaries } from '../../../lib/market-archive/popularity';
import type { MarketSummary } from '../../../lib/market-archive/summary';

const query = z.object({
  q: z.string().max(200).default(''),
  brand: z.string().max(160).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(24),
  group: z.enum(['0', '1']).default('1'),
  currency: z.string().optional(), // read above: unknown codes fall back to EUR
});

/**
 * The market price shown on a card: this variant's, or, when it has none yet, the best-covered variant of the same
 * reference (variants share most listings, which name only the base reference).
 */
async function withMarket<T extends Model>(items: T[], currency: string) {
  const [summaries, rates] = await Promise.all([marketSummaries(), getFx()]);
  const priceOf = (s: MarketSummary | undefined) => (s && s.priceEur !== null ? s : undefined);
  return items.map((m) => {
    const own = priceOf(summaries.get(m.id));
    const summary = own || variantsOf(m).map((v) => priceOf(summaries.get(v.id))).filter(Boolean).sort((a, b) => b!.count - a!.count)[0];
    if (!summary) return m;
    const converted = convertPrice(summary.priceEur!, 'EUR', currency, rates?.fx ?? null);
    const market = converted === null ? { price: summary.priceEur!, currency: 'EUR' } : { price: Math.round(converted), currency };
    return { ...m, market: { ...market, count: summary.count } };
  });
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const currency = currencies.find((c) => c === params.get('currency')) || 'EUR';
  if (params.get('facets') === 'brands') return Response.json({ brands: brandCounts }, { headers: { 'Cache-Control': 'public, max-age=3600' } });

  if (params.has('ids')) {
    const ids = params.get('ids')!.split(',');
    if (ids.length > 200) return Response.json({ error: 'Request at most 200 model IDs.' }, { status: 400 });
    return Response.json({ items: ids.map(findCatalogModel).filter(Boolean) });
  }

  // All dial/bracelet variants of a reference, labelled by what differs between them.
  if (params.has('variants')) {
    const model = findCatalogModel(params.get('variants')!.slice(0, 160));
    if (!model) return Response.json({ error: 'Watch model not found.' }, { status: 404 });
    const variants = variantsOf(model);
    const items = variants.map((v) => ({ ...v, label: variantLabel(v, variants), dial: dialOf(v) }));
    return Response.json({ items: await withMarket(items, currency) }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  }

  // Most tracked: watches with the most priced market observations (asking prices, sales, auction results).
  if (params.get('popular') === '1') {
    const limit = Math.min(Math.max(Number(params.get('limit')) || 12, 1), 24);
    return Response.json({ items: await withMarket(mostTracked(await marketPopularity(), limit), currency) }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  }

  const input = query.safeParse(Object.fromEntries(params));
  if (!input.success) return Response.json({ error: 'Invalid catalog query.' }, { status: 400 });
  const { q, brand, page, limit, group } = input.data;
  const result = searchCatalog({ q, brand, page, pageSize: limit, popularity: await marketPopularity(), group: group === '1' });
  return Response.json({ ...result, items: await withMarket<SearchItem>(result.items, currency) }, { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' } });
}
