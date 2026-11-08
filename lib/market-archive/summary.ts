import { convertPrice, type Fx } from '../market';
import { dedupeCrossPosts, median, withoutOutliers } from '../metrics';

/** One listing from a watch's archive that names its base reference (any dial). */
export type PricedRow = {
  modelId: string;
  price: number;
  currency: string;
  status: string;
  match: string;
  sourceId: string;
  observedAt: string;
  listedAt?: string | null;
  title?: string | null;
};

/** priced: complete/same-reference observations ever archived (ranking); priceEur/count: 1-year all-dials market price. */
export type MarketSummary = { priced: number; priceEur: number | null; count: number };

const DAY = 86_400_000;
// Active classified ads count as current; forum posts and sales count on their post or sale date.
const CLASSIFIEDS = new Set(['tori', 'finn', 'blocket', 'dba', 'ebay', 'kellotux', 'laatukellot']);

/**
 * The watch page's default market price (median, 1 year, all regions, all dials) for every archived watch, in EUR,
 * so cards and search results can show it. Same rules as the page: cross-posts once, far-off prices excluded.
 */
export function summarizeMarkets(rows: PricedRow[], fx: Fx | null, now = Date.now()): Map<string, MarketSummary> {
  const since = new Date(now - 365 * DAY).toISOString().slice(0, 10);
  const byModel = new Map<string, PricedRow[]>();
  for (const row of rows) byModel.set(row.modelId, [...(byModel.get(row.modelId) || []), row]);
  const out = new Map<string, MarketSummary>();
  for (const [modelId, listings] of byModel) {
    const candidates = dedupeCrossPosts(
      listings.flatMap((r) => {
        const date = r.status === 'asking' && CLASSIFIEDS.has(r.sourceId) ? r.observedAt : r.listedAt || r.observedAt;
        const price = convertPrice(r.price, r.currency, 'EUR', fx);
        return price === null || date < since ? [] : [{ price, date, status: r.status, title: r.title ?? undefined }];
      }),
    );
    const { kept } = withoutOutliers(candidates, (c) => c.price);
    out.set(modelId, { priced: listings.filter((r) => r.match !== 'similar').length, priceEur: kept.length ? Math.round(median(kept.map((c) => c.price))!) : null, count: kept.length });
  }
  return out;
}
