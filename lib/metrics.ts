// WatchCharts-style market metrics, computed only from observed prices for one exact reference.
// Every metric returns null when there is not enough data, rather than guessing.

export type MetricPrice = {
  date: string; // listing or observation date (YYYY-MM-DD)
  price: number;
  status: string; // asking | sold-asking | confirmed-sale
  condition?: string;
  contents?: string;
  sellerType?: string;
  active?: boolean; // currently for sale
  listedAt?: string;
};

const DAY = 86_400_000;
export function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
/**
 * Drops prices far from the pack: deposits, "partial trade" figures, parts sold under the reference,
 * mistyped prices. Uses the median absolute deviation, which a few bad prices cannot drag along.
 * Needs at least 5 prices; with fewer there is no reliable "pack" to compare against.
 */
export function withoutOutliers<T>(items: T[], price: (x: T) => number, k = 4): { kept: T[]; dropped: T[] } {
  if (items.length < 5) return { kept: items, dropped: [] };
  const m = median(items.map(price))!;
  // Floor the spread at 5% of the median so a run of identical prices does not reject every other value.
  const mad = Math.max(median(items.map((x) => Math.abs(price(x) - m)))!, m * 0.05);
  const kept: T[] = [], dropped: T[] = [];
  for (const x of items) (Math.abs(price(x) - m) / (1.4826 * mad) > k || price(x) < m * 0.4 || price(x) > m * 2.5 ? dropped : kept).push(x);
  return { kept, dropped };
}

/** The same watch cross-posted (Reddit + forum + classifieds) or re-posted is one observation, not several. */
export function dedupeCrossPosts<T extends { title?: string; price: number; date: string; status?: string }>(items: T[], windowDays = 21): T[] {
  const key = (t = '') => t.toLowerCase().replace(/\[[^\]]*\]/g, '').replace(/^\W*(?:wts|wtt|fs|fsot|for sale|myydään|selges|säljes|sælges|verkaufe)\b\W*/, '').replace(/[^a-z0-9]/g, '').slice(0, 48);
  const out: T[] = [];
  for (const x of [...items].sort((a, b) => b.date.localeCompare(a.date))) {
    const k = key(x.title);
    // Separate auction lots can have the same model, amount and date; their URLs were already deduplicated upstream.
    if (x.status !== 'confirmed-sale' && k.length >= 12 && out.some((y) => y.status !== 'confirmed-sale' && key(y.title) === k && Math.abs(y.price - x.price) <= x.price * 0.02 && Math.abs(+new Date(y.date) - +new Date(x.date)) <= windowDays * DAY)) continue;
    out.push(x);
  }
  return out;
}

function weekStart(date: string) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function weeklyMedians(prices: MetricPrice[]) {
  const g = new Map<string, number[]>();
  for (const p of prices) g.set(weekStart(p.date), [...(g.get(weekStart(p.date)) || []), p.price]);
  return [...g].sort(([a], [b]) => a.localeCompare(b)).map(([week, xs]) => ({ week, value: median(xs)! }));
}
const ratio = (a: number | null, b: number | null) => (a !== null && b !== null && b > 0 ? a / b - 1 : null);
const groupMedian = (xs: MetricPrice[], f: (p: MetricPrice) => boolean, min = 2) => {
  const v = xs.filter(f).map((p) => p.price);
  return v.length >= min ? median(v) : null;
};

export type RiskCheck = { label: string; detail: string; ok: boolean | null };
export type Metrics = {
  volatility: number | null;
  change1y: number | null;
  valueRetention: number | null;
  inception: string | null;
  volume1y: number;
  sold1y: number;
  medianDaysListed: number | null;
  newPremium: number | null;
  noBoxDiscount: number | null;
  dealerPrice: number | null;
  privatePrice: number | null;
  risk: { score: number; label: string; checks: RiskCheck[] } | null;
};

export function computeMetrics(all: MetricPrice[], { retail = null as number | null, market = null as number | null, now = Date.now() } = {}): Metrics {
  const yearAgo = new Date(now - 365 * DAY).toISOString().slice(0, 10);
  const year = all.filter((p) => p.date >= yearAgo);
  const weeks = weeklyMedians(year);

  // Volatility: coefficient of variation of weekly medians over the last year.
  let volatility: number | null = null;
  if (weeks.length >= 3) {
    const vals = weeks.map((w) => w.value), mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    volatility = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (vals.length - 1)) / mean;
  }
  // 1-year change: median of the first quarter of the year vs the latest quarter, each with at least 3 prices.
  // Comparing single first/last weeks swung with whichever one listing happened to be posted that week.
  const quarterAgo = new Date(now - 90 * DAY).toISOString().slice(0, 10), firstQuarterEnd = new Date(now - 275 * DAY).toISOString().slice(0, 10);
  const early = year.filter((p) => p.date < firstQuarterEnd).map((p) => p.price), late = year.filter((p) => p.date >= quarterAgo).map((p) => p.price);
  const change1y = early.length >= 3 && late.length >= 3 ? median(late)! / median(early)! - 1 : null;
  const today = new Date(now).toISOString().slice(0, 10);
  const ages = all.filter((p) => p.active && p.listedAt && p.listedAt <= today).map((p) => Math.round((now - +new Date(p.listedAt + 'T12:00:00Z')) / DAY));
  const used = groupMedian(year, (p) => p.condition === 'used');
  const sold1y = year.filter((p) => p.status !== 'asking').length;

  const metrics: Metrics = {
    volatility,
    change1y,
    valueRetention: ratio(market, retail),
    inception: all.length ? all.map((p) => p.date).sort()[0] : null,
    volume1y: year.length,
    sold1y,
    medianDaysListed: ages.length ? median(ages) : null,
    newPremium: ratio(groupMedian(year, (p) => p.condition === 'new'), used),
    noBoxDiscount: ratio(groupMedian(year, (p) => p.contents === 'watch-only'), groupMedian(year, (p) => p.contents === 'full-set')),
    dealerPrice: groupMedian(year, (p) => p.sellerType === 'dealer' && p.status === 'asking'),
    privatePrice: groupMedian(year, (p) => p.sellerType === 'private'),
    risk: null,
  };

  // Risk score (0 = low risk, 100 = high): price swings, falling prices, thin market, little data.
  if (year.length >= 3) {
    const vol = Math.min((volatility ?? 0.1) / 0.15, 1);
    const fall = Math.min(Math.max(-(change1y ?? 0) / 0.2, 0), 1);
    const thin = 1 - Math.min(year.length / 40, 1);
    const below = metrics.valueRetention !== null ? Math.min(Math.max(-metrics.valueRetention / 0.3, 0), 1) : 0.5;
    const score = Math.round(100 * (0.35 * vol + 0.25 * fall + 0.25 * thin + 0.15 * below));
    const pct = (x: number | null) => (x === null ? 'not enough data' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`);
    metrics.risk = {
      score,
      label: score < 34 ? 'Low risk' : score < 67 ? 'Moderate risk' : 'High risk',
      checks: [
        { label: 'Stable prices', detail: `Volatility ${volatility === null ? 'not enough data' : (volatility * 100).toFixed(1) + '%'} (under 8% is stable)`, ok: volatility === null ? null : volatility < 0.08 },
        { label: 'Holding value over 1 year', detail: `Price change ${pct(change1y)}`, ok: change1y === null ? null : change1y >= -0.03 },
        { label: 'Liquid market', detail: `${year.length} prices seen in 1 year (20+ is liquid)`, ok: year.length >= 20 },
        { label: 'Above retail', detail: metrics.valueRetention === null ? 'Add the retail price to compare' : `Value retention ${pct(metrics.valueRetention)}`, ok: metrics.valueRetention === null ? null : metrics.valueRetention >= 0 },
        { label: 'Enough data', detail: `${all.length} dated prices in total (10+ gives a usable estimate)`, ok: all.length >= 10 },
      ],
    };
  }
  return metrics;
}
