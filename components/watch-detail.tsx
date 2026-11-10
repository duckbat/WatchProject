'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BadgeCheck, Bookmark, BookmarkCheck, ChevronDown, ChevronRight, ChevronsRight, ExternalLink, Info, Plus, RefreshCw, Store, Trash2, Watch, X } from 'lucide-react';
import { brandSiteFor, convertPrice, countries, defaultSources, facebookGroupSearchUrl, feeBreakdown, inRegion, retailLookupUrl, latestListings, money, summarize, type Entry, type Model, type Observation } from '../lib/market';
import FilterBar from './filter-bar';
import { baseReference } from '../lib/collectors/matching/reference';
import { exactMatch } from '../lib/collectors/matching/classify';
import { classifyIdentity } from '../lib/collectors/matching/structured';
import { expectedDial, namesDial } from '../lib/collectors/matching/dial';
import { listingKind } from '../lib/market-archive/listings';
import PriceScatter, { sourceColors, type ChartPoint } from './price-scatter';
import PriceHistory from './price-history';
import { DaysChart, MetricsGrid, RiskPanel, VolumeChart } from './market-charts';
import { computeMetrics, dedupeCrossPosts, median, withoutOutliers, type MetricPrice } from '../lib/metrics';
import ModelSpecs from './model-specs';
import { FavoriteButton } from './favorites';
import { RememberPrice } from './price-cache';
import WatchPhoto from './watch-photo';
import { WatchCard } from './home-view';
import { matchesPrefs, periodStart, periods, regions, statuses, today, type LiveListing, type LiveResult, type ModalKind, type Prefs, type Route } from './shared';

type Props = {
  modelId: string;
  model: Model | undefined;
  entries: Entry[];
  sourceName: (id: string) => string;
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onNavigate: (r: Route) => void;
  onModal: (k: ModalKind) => void;
  onSaveListing: (l: LiveListing) => Promise<void>;
  onRemove: (id: string) => void;
  onModels: (ms: Model[]) => void;
  signedIn: boolean;
  groupSources?: { id: string; name: string; url?: string }[];
  onSaveRecord: (kind: string, data: Record<string, unknown>) => Promise<void>;
  fx?: import('../lib/market').Fx | null;
};

/** Swatch colors for the dial names the catalog uses. */
const dialSwatch: Record<string, string> = {
  black: '#16181a', white: '#f4f4f0', blue: '#234a8c', green: '#1f5c3d', silver: '#c3c7cb', grey: '#7d8288', champagne: '#d8c39a',
  brown: '#6b4a33', pink: '#e8b4c0', purple: '#5d3a78', red: '#a3262a', orange: '#db7a2c', yellow: '#e4c44c', salmon: '#f1a58b',
  turquoise: '#3fb3b0', beige: '#d9cbb0', ivory: '#f1ead6', slate: '#4b5661', rhodium: '#8f9499', anthracite: '#3a3d40', cream: '#efe5cc', coral: '#ef7f69',
};

function ago(iso: string) {
  const m = Math.round((Date.now() - +new Date(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

export default function WatchDetail({ modelId, model, entries, sourceName, prefs, onPrefs, onNavigate, onModal, onSaveListing, onRemove, onModels, signedIn, groupSources = [], onSaveRecord, fx = null }: Props) {
  const [live, setLive] = useState<LiveResult | null>(null);
  const [liveState, setLiveState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [liveError, setLiveError] = useState('');
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState('');
  const [showSimilar, setShowSimilar] = useState(false);
  // Other models stored for this watch are not in the first load; they arrive when "Show similar" is opened.
  const [otherSimilar, setOtherSimilar] = useState<{ modelId: string; listings: LiveListing[] } | null>(null);
  const [related, setRelated] = useState<Model[]>([]);
  const [sellInput, setSellInput] = useState('');
  const [chartTab, setChartTab] = useState<'listings' | 'volume' | 'days'>('listings');
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());
  const [retailEdit, setRetailEdit] = useState(false);
  const [retailInput, setRetailInput] = useState('');
  const [showSources, setShowSources] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [specsOpen, setSpecsOpen] = useState(false);
  const [variants, setVariants] = useState<Model[]>([]);
  const [variantQuery, setVariantQuery] = useState('');
  const [newRegion, setNewRegion] = useState('Global');
  const [showGoneOffers, setShowGoneOffers] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [dialsOpen, setDialsOpen] = useState(false);

  useEffect(() => {
    if (model) return;
    fetch(`/api/catalog?ids=${encodeURIComponent(modelId)}`)
      .then((r) => r.json())
      .then((d: any) => (d.items?.length ? onModels(d.items) : setMissing(true)))
      .catch(() => setMissing(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId, model]);

  // The server answers at once with the stored archive while it collects newer prices; fetch once more afterwards.
  const followUp = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loadLive = useCallback(
    (refresh = false) => {
      setLiveState('loading');
      setLiveError('');
      clearTimeout(followUp.current);
      const url = `/api/market/live?${new URLSearchParams({ modelId, refresh: refresh ? '1' : '0' })}`;
      return fetch(url)
        .then(async (r) => {
          const d: any = await r.json();
          if (!r.ok) throw new Error(d.error || 'Live prices unavailable');
          setLive(d);
          setLiveState('ready');
          if (d.refreshing)
            followUp.current = setTimeout(() => {
              fetch(url)
                .then((n): Promise<LiveResult | null> | null => (n.ok ? n.json() : null))
                .then((n: LiveResult | null) => n && n.fetchedAt !== d.fetchedAt && setLive({ ...n, refreshing: false }))
                .catch(() => undefined);
            }, 15_000);
        })
        .catch((e) => {
          setLiveError(e.message);
          setLiveState('error');
        });
    },
    [modelId],
  );
  useEffect(() => {
    setLive(null);
    setShowSimilar(false);
    if (signedIn) loadLive();
    else {
      setLiveState('error');
      setLiveError('Sign in to load live marketplace prices.');
    }
    return () => clearTimeout(followUp.current);
  }, [modelId, loadLive, signedIn]);
  const othersToLoad = showSimilar && (live?.otherSimilar ?? 0) > 0 && otherSimilar?.modelId !== modelId;
  useEffect(() => {
    if (!othersToLoad) return;
    const controller = new AbortController();
    fetch(`/api/market/live?${new URLSearchParams({ modelId, similar: '1' })}`, { signal: controller.signal })
      .then((r): Promise<{ listings?: LiveListing[] }> | { listings?: LiveListing[] } => (r.ok ? r.json() : { listings: [] }))
      .then((d: { listings?: LiveListing[] }) => setOtherSimilar({ modelId, listings: d.listings || [] }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [othersToLoad, modelId]);
  const othersLoaded = otherSimilar?.modelId === modelId ? otherSimilar.listings : null;

  // The new-price and dial dialogs close with Escape, like the other dialogs.
  useEffect(() => {
    if (!newOpen && !dialsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setNewOpen(false);
      setDialsOpen(false);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [newOpen, dialsOpen]);

  // Other dials/bracelets of the same reference, for the picker under the photo.
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/catalog?${new URLSearchParams({ variants: modelId, currency: prefs.currency })}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ items?: Model[] }>) : null))
      .then((d) => setVariants(d?.items || []))
      .catch(() => {});
    return () => controller.abort();
  }, [modelId, prefs.currency]);

  useEffect(() => {
    if (!model) return;
    const line = model.name.split(/[\s/]+/).slice(0, /^\d{2}/.test(model.name.split(/\s+/)[1] || '') ? 2 : 1).join(' ');
    fetch(`/api/catalog?${new URLSearchParams({ q: line, brand: model.brand, limit: '9', currency: prefs.currency })}`)
      .then((r) => r.json())
      .then((d: any) => setRelated((d.items || []).filter((m: Model) => m.id !== model.id).slice(0, 8)))
      .catch(() => setRelated([]));
  }, [model, prefs.currency]);

  if (missing && !model)
    return (
      <div className="empty page-empty">
        <Watch />
        <h3>Watch not found</h3>
        <p>This reference is not in the catalog.</p>
        <button className="secondary" onClick={() => onNavigate({ view: 'home' })}>Back to search</button>
      </div>
    );
  if (!model) return <div className="detail-skeleton" aria-busy="true" />;

  // ---- Data ----
  // Prices in other currencies are converted with ECB reference rates (unless switched off) and marked as converted.
  const toCur = (price: number, cur: string) => (cur === prefs.currency ? price : prefs.convert === 'off' ? null : convertPrice(price, cur, prefs.currency, fx));
  const savedAll = entries.filter((e) => e.kind === 'observation' && e.data.modelId === modelId) as (Entry & { data: Observation })[];
  const saved = savedAll.flatMap((e) => {
    const p = toCur(e.data.price, e.data.currency);
    return p === null ? [] : [{ ...e, data: { ...e.data, price: Math.round(p), currency: prefs.currency, originalPrice: e.data.currency === prefs.currency ? undefined : e.data.price, originalCurrency: e.data.currency === prefs.currency ? undefined : e.data.currency } }];
  });
  const savedShown = saved.filter((e) => matchesPrefs(e.data, prefs));
  const listings: LiveListing[] = [...(live?.listings || []), ...(othersLoaded || [])].flatMap((l) => {
    const p = toCur(l.price, l.currency);
    return p === null ? [] : [l.currency === prefs.currency ? l : { ...l, price: Math.round(p), currency: prefs.currency, originalPrice: l.price, originalCurrency: l.currency }];
  });
  const convertedCount = listings.filter((l) => l.originalCurrency && l.match !== 'similar').length + saved.filter((e) => (e.data as any).originalCurrency).length;
  const liveIn = (l: LiveListing) => l.currency === prefs.currency && inRegion(l.country, prefs.region) && (prefs.condition === 'all' || l.condition === prefs.condition) && (prefs.seller === 'all' || l.sellerType === prefs.seller) && (prefs.basis === 'all' || l.status === prefs.basis) && l.observedAt >= periodStart(prefs.period);
  // Priced listings: the complete reference, or the base reference with the variant unstated (labelled on each card).
  // Dial scope. All dials: every listing naming the base reference, whatever its dial (other-dial listings are archived
  // as "similar" for the open variant). One dial: the complete variant reference, or the base reference plus this
  // dial's color; variants the catalog gives no single dial color keep "dial not stated" listings.
  const base = baseReference(model.reference);
  const hasVariants = variants.length > 1;
  const variantTerms = variantQuery.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const currentVariant = variants.find((v) => v.id === model.id);
  const shownVariants = variants.filter((v) => variantTerms.every((term) => `${v.label} ${v.reference}`.toLocaleLowerCase().includes(term)));
  const allDials = hasVariants && prefs.dialScope !== 'dial';
  const dialKnown = expectedDial(model.name).size === 1;
  const counts = (l: LiveListing) =>
    allDials
      ? l.identity ? ['exact', 'reference'].includes(classifyIdentity(l.title, { ...model, reference: base, name: model.name.split('/')[0] }, l.identity, l.matchDetails) || '') : l.match !== 'similar' || exactMatch(l.title, { brand: model.brand, reference: base }, l.matchDetails)
      : l.match === 'exact' || (l.match === 'reference' && (!hasVariants || !dialKnown || namesDial(`${l.title} ${l.matchDetails || ''}`, model.name)));
  // Listings counted only because of the scope are shown as same-reference listings.
  const exact = listings.filter(counts).map((l) => (l.match === 'similar' ? { ...l, match: 'reference' as const } : l));
  const similar = listings.filter((l) => !counts(l));
  const exactIn = exact.filter(liveIn);
  const similarIn = similar.filter(liveIn);
  // Market price: asking AND sold prices for this exact reference (independent of the price-type chart filter).
  const inScope = (o: { currency: string; country: string; condition: string; sellerType: string }) =>
    o.currency === prefs.currency && inRegion(o.country, prefs.region) && (prefs.condition === 'all' || o.condition === prefs.condition) && (prefs.seller === 'all' || o.sellerType === prefs.seller);
  const periodOk = (d: string) => prefs.period === '36500' || d >= periodStart(prefs.period);
  const isSold = (status: string) => status === 'sold-asking' || status === 'confirmed-sale';
  const exactUrls = new Set(exact.map((l) => l.url));
  const classifieds = new Set(['tori', 'finn', 'blocket', 'dba', 'ebay', 'kellotux', 'laatukellot']);
  const candidates = dedupeCrossPosts([
    // Active marketplace listings count as current; forum posts count on their post date.
    ...exact.map((l) => ({ ...l, date: l.status === 'asking' && classifieds.has(l.sourceId) ? l.observedAt : l.listedAt || l.observedAt })).filter((l) => inScope(l) && periodOk(l.date)).map((l) => ({ price: l.price, status: l.status, date: l.date, title: l.title, variant: l.match === 'exact', converted: Boolean(l.originalCurrency) })),
    ...latestListings(saved.filter((e) => inScope(e.data) && periodOk(e.data.observedAt) && !(e.data.url && exactUrls.has(e.data.url)))).map((e) => ({ price: e.data.price, status: e.data.status, date: e.data.observedAt, title: (e.data as any).title as string | undefined, variant: true, converted: Boolean((e.data as any).originalCurrency) })),
  ]);
  // With enough complete-variant prices, the variant alone sets the price; otherwise same-reference listings fill in.
  const variantOnly = !allDials && candidates.filter((p) => p.variant).length >= 3;
  const { kept: pool, dropped: outliers } = withoutOutliers(variantOnly ? candidates.filter((p) => p.variant) : candidates, (p) => p.price);
  const nReference = pool.filter((p) => !p.variant).length;
  const soldPool = pool.filter((p) => isSold(p.status));
  const reportedSales = soldPool.filter((p) => p.status === 'confirmed-sale');
  const soldAsks = soldPool.filter((p) => p.status === 'sold-asking');
  const marketPrice = summarize(pool.map((p) => p.price), prefs.method);
  const soldPrice = summarize(reportedSales.map((p) => p.price), prefs.method);
  const soldAskPrice = summarize(soldAsks.map((p) => p.price), prefs.method);
  const lastSold = reportedSales.map((p) => p.date).sort().at(-1) || null;
  const rangeLabel = periods.find(([v]) => v === prefs.period)?.[1];
  const nConverted = pool.filter((p) => p.converted).length;
  const marketBasis = pool.length
    ? `${prefs.method === 'median' ? 'Median' : 'Average'} of ${pool.length} price${pool.length === 1 ? '' : 's'} (${pool.length - soldPool.length} asking · ${soldPool.length} sold) · ${rangeLabel}${nReference ? ` · ${nReference} for Ref. ${baseReference(model.reference)} without a stated dial/bracelet` : ''}${outliers.length ? ` · ${outliers.length} outlier${outliers.length === 1 ? '' : 's'} excluded` : ''}${nConverted ? ` · ${nConverted} converted to ${prefs.currency}` : ''}`
    : '';
  const otherCurrencies = (live?.listings || []).filter((l) => l.match === 'exact' && !listings.some((x) => x.url === l.url)).map((l) => l.currency);
  const otherCurrency = otherCurrencies.length;
  const topOther = otherCurrencies.sort((a, b) => otherCurrencies.filter((x) => x === b).length - otherCurrencies.filter((x) => x === a).length)[0];
  const sellPrice = Number(sellInput) > 0 ? Number(sellInput) : marketPrice;
  const fees = sellPrice ? feeBreakdown(sellPrice, 'chrono24') : null;
  const sortedExact = [...exactIn].sort((a, b) => (b.listedAt || b.observedAt).localeCompare(a.listedAt || a.observedAt));
  const liveUrls = new Set(exactIn.map((l) => l.url));
  // Charts hide the same far-off prices the market price excludes, so one deposit or typo cannot flatten the scale.
  const keptPrices = pool.map((p) => p.price);
  const inBand = (price: number) => !outliers.length || !keptPrices.length || (price >= Math.min(...keptPrices) && price <= Math.max(...keptPrices));
  const historyPrices = [
    ...savedShown.filter((e) => !liveUrls.has(e.data.url)).map((e) => ({ date: e.data.observedAt, price: e.data.price })),
    ...exactIn.map((l) => ({ date: l.listedAt || l.observedAt, price: l.price })),
  ].filter((p) => (prefs.period === '36500' || p.date >= periodStart(prefs.period)) && inBand(p.price));
  const savedToday = new Set(saved.filter((e) => e.data.observedAt === today()).map((e) => e.data.url));
  const owned = entries.filter((e) => e.kind === 'owned' && e.data.modelId === modelId);

  const points: ChartPoint[] = [
    ...savedShown.filter((e) => !(e.data.observedAt === today() && exactIn.some((l) => l.url === e.data.url))).map((e) => ({ id: e.id, date: e.data.observedAt, price: e.data.price, kind: e.data.status as ChartPoint['kind'], title: ((e.data as any).title || `${model.brand} ${model.reference}`) + ((e.data as any).originalCurrency ? ` (converted from ${money((e.data as any).originalPrice, (e.data as any).originalCurrency)})` : ''), url: e.data.url || undefined, source: sourceName(e.data.sourceId), country: countries[e.data.country] || e.data.country })),
    ...[...exactIn, ...(showSimilar ? similarIn : [])].map((l) => ({ id: `live-${l.url}`, date: l.listedAt || l.observedAt, undated: !l.listedAt && !l.archived, price: l.price, kind: listingKind(l), title: l.title + (l.originalCurrency ? ` (converted from ${money(l.originalPrice!, l.originalCurrency)})` : ''), url: l.url, source: sourceName(l.sourceId), country: countries[l.country] || l.country })),
  ];

  const regional = regions.filter(([r]) => r !== 'Global').map(([r, name]) => {
    const pool = [
      ...latestListings(saved.filter((e) => matchesPrefs(e.data, prefs, { region: false }) && inRegion(e.data.country, r))).map((e) => e.data.price),
      ...exact.filter((l) => l.currency === prefs.currency && inRegion(l.country, r) && !savedToday.has(l.url)).map((l) => l.price),
    ];
    return { r, name, n: pool.length, v: summarize(pool, prefs.method) };
  });

  // ---- WatchCharts-style metrics (exact reference, selected currency and region, all dates) ----
  const regionOk = (country: string) => inRegion(country, prefs.region);
  const metricPrices: MetricPrice[] = [
    ...saved.filter((e) => e.data.currency === prefs.currency && regionOk(e.data.country) && !exact.some((l) => e.data.url && l.url === e.data.url)).map((e) => ({ date: e.data.observedAt, price: e.data.price, status: e.data.status, condition: e.data.condition, contents: e.data.contents, sellerType: e.data.sellerType })),
    ...exact.filter((l) => l.currency === prefs.currency && regionOk(l.country)).map((l) => ({ date: l.listedAt || l.observedAt, price: l.price, status: l.status, condition: l.condition, contents: l.contents, sellerType: l.sellerType, active: !l.archived && l.status === 'asking' && classifieds.has(l.sourceId), listedAt: l.listedAt })),
  ];
  const retails = entries.filter((e) => e.kind === 'retail' && e.data.modelId === modelId).sort((a, b) => String(b.data.asOf).localeCompare(String(a.data.asOf)));
  const retail = retails.find((e) => e.data.currency === prefs.currency);
  const shopOffers = (live?.retailOffers || []).filter(counts).flatMap((l) => {
    const price = toCur(l.price, l.currency);
    return price === null ? [] : [{ ...l, price, currency: prefs.currency, originalPrice: l.price, originalCurrency: l.currency }];
  }).sort((a, b) => a.price - b.price);
  // One offer per website: its cheapest in-stock one (eBay can have many dealer listings; it counts once).
  // Websites with nothing in stock any more keep their last seen offer, shown separately.
  const perSite = (offers: LiveListing[]) => {
    const best = new Map<string, LiveListing>();
    for (const l of offers) if (!best.has(l.sourceId) || l.price < best.get(l.sourceId)!.price) best.set(l.sourceId, l);
    return [...best.values()].sort((a, b) => a.price - b.price);
  };
  // New price by region: an offer's item location, or the shop's home country when the offer has none.
  const offerCountry = (l: LiveListing) => (l.country !== 'UNKNOWN' ? l.country : defaultSources.find((s) => s.id === l.sourceId)?.country || 'UNKNOWN');
  const newRegions: [string, string][] = [['Global', 'All'], ['EU', 'Europe'], ['US', 'US'], ['Asia', 'Asia']];
  const offersIn = (r: string) => shopOffers.filter((l) => r === 'Global' || inRegion(offerCountry(l), r));
  const sitesIn = (r: string) => {
    const current = perSite(offersIn(r).filter((l) => !l.archived));
    return { current, gone: perSite(offersIn(r).filter((l) => l.archived && !current.some((c) => c.sourceId === l.sourceId))) };
  };
  const mean = (xs: number[]) => (xs.length ? xs.reduce((sum, x) => sum + x, 0) / xs.length : null);
  const average = (offers: LiveListing[]) => mean(offers.map((l) => l.price));
  const allSites = sitesIn('Global');
  const currentShopOffers = allSites.current;
  const cheapestShop = currentShopOffers[0];
  const shopAverage = average(currentShopOffers);
  const newSites = sitesIn(newRegion);

  // Average price per dial variant, second-hand and new. A listing counts for a dial when it names that variant's
  // full reference, or the base reference plus the dial's colour (a shop's own dial field counts too).
  const baseListings = listings.filter((l) => periodOk(l.listedAt || l.observedAt) && exactMatch(l.title, { brand: model.brand, reference: base }, l.matchDetails));
  const forDial = (v: Model, l: LiveListing) =>
    exactMatch(l.title, v, l.matchDetails) || namesDial(`${l.title} ${l.matchDetails || ''}${l.identity?.dial ? ` ${l.identity.dial} dial` : ''}`, v.name);
  const usedAverage = (prices: number[]) => mean(withoutOutliers(prices, (x) => x).kept);
  const dialPrices = (v: Model) => {
    const used = baseListings.filter((l) => l.currency === prefs.currency && forDial(v, l)).map((l) => l.price);
    const shops = perSite(shopOffers.filter((l) => !l.archived && forDial(v, l)));
    return { used: usedAverage(used), usedN: used.length, fresh: average(shops), freshN: shops.length };
  };
  // All dials: ranges instead of averages (cheapest to most expensive, far-off prices excluded), plus sales over
  // five years: the cheapest one and the median.
  const kept = (prices: number[]) => withoutOutliers(prices, (x) => x).kept.sort((a, b) => a - b);
  const allUsed = kept(baseListings.filter((l) => l.currency === prefs.currency).map((l) => l.price));
  const allNew = currentShopOffers.map((l) => l.price).sort((a, b) => a - b);
  const fiveYears = periodStart('1826');
  const allSold = kept(
    listings
      .filter((l) => (l.status === 'confirmed-sale' || l.status === 'sold-asking') && l.currency === prefs.currency && (l.listedAt || l.observedAt) >= fiveYears)
      .filter((l) => exactMatch(l.title, { brand: model.brand, reference: base }, l.matchDetails))
      .map((l) => l.price),
  ).filter((price) => {
    // Few sales cannot judge their own outliers: compare with the (larger) used-listing pool instead.
    const typical = allUsed.length >= 5 ? median(allUsed)! : null;
    return typical === null || (price >= typical * 0.4 && price <= typical * 2.5);
  });
  const priceRange = (xs: number[]) => (!xs.length ? '–' : xs[0] === xs[xs.length - 1] ? money(xs[0], prefs.currency) : `${money(xs[0], prefs.currency)} – ${money(xs[xs.length - 1], prefs.currency)}`);
  const compact = (n: number | null) => (n === null ? '–' : new Intl.NumberFormat('en', { style: 'currency', currency: prefs.currency, notation: 'compact', maximumFractionDigits: 1 }).format(n));
  const metrics = computeMetrics(metricPrices, { retail: retail?.data.price ?? null, market: marketPrice });
  const ages = metricPrices.filter((p) => p.active && p.listedAt).map((p) => Math.round((Date.now() - +new Date(p.listedAt + 'T12:00:00Z')) / 86_400_000));
  // Most prices first; the order fixes each source's colour, shared by its button and its dots.
  const sourcesInChart = [...new Set(points.map((p) => p.source))].map((name) => ({ name, n: points.filter((p) => p.source === name).length })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const chartColors = sourceColors(sourcesInChart.map((s) => s.name));
  const chartPoints = points.filter((p) => !hiddenSources.has(p.source) && inBand(p.price));
  const hiddenOutliers = points.length - points.filter((p) => inBand(p.price)).length;
  const fmtDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  async function saveRetail() {
    const price = Number(retailInput);
    if (!(price > 0)) return;
    await onSaveRecord('retail', { modelId, price, currency: prefs.currency, asOf: today() });
    setRetailEdit(false);
    setRetailInput('');
  }

  async function save(l: LiveListing) {
    setSaving(l.url);
    try {
      // Save what the seller actually asked, not the converted figure.
      await onSaveListing(l.originalCurrency ? { ...l, price: l.originalPrice!, currency: l.originalCurrency, originalPrice: undefined, originalCurrency: undefined } : l);
    } finally {
      setSaving('');
    }
  }

  // Second-hand and new averages on a dial tile; while sources are checked, a shimmer stands in.
  const dialPrice = (used: number | null, fresh: number | null) =>
    liveState === 'loading' && !live ? (
      <span className="dial-price"><span className="skeleton-line" style={{ width: 54, height: 9 }} /></span>
    ) : (
      <span className="dial-price">
        <span title="Second-hand market average">Used {compact(used)}</span>
        <span title="Professional shops, new (one offer per website)">New {compact(fresh)}</span>
      </span>
    );

  // One place selling the watch new: shop, where it ships from, its price and a link.
  const shopOfferRow = (l: LiveListing, region?: string) => {
    const more = region ? offersIn(region).filter((o) => !o.archived && o.sourceId === l.sourceId).length - 1 : 0;
    return (
    <a key={l.url} className={`shop-offer${l.archived ? ' gone' : ''}`} href={l.url} target="_blank" rel="noreferrer">
      <span>
        <strong>{sourceName(l.sourceId)}</strong>
        <small>
          {countries[offerCountry(l)] || 'Location not stated'} · {l.archived ? `last seen ${fmtDate((l.lastSeenAt || l.collectedAt).slice(0, 10))}` : `in stock · checked ${fmtDate(l.observedAt)}`}
        </small>
        <small className="shop-offer-title">{l.title}</small>
        {more > 0 && <small>Cheapest of {more + 1} offers on this website</small>}
      </span>
      <span>
        <strong>{money(l.price, l.currency)}</strong>
        {l.originalCurrency && l.originalCurrency !== prefs.currency && <small>{money(l.originalPrice ?? null, l.originalCurrency)}</small>}
      </span>
      <ArrowUpRight size={15} />
    </a>
    );
  };

  const ListingCard = ({ l }: { l: LiveListing }) => {
    const isSaved = savedToday.has(l.url);
    return (
      <article className={`listing${l.match === 'similar' ? ' similar' : ''}`}>
        <a className="listing-photo" href={l.url} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden>
          {l.image ? <img src={l.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Watch size={28} strokeWidth={1} />}
        </a>
        <div className="listing-body">
          <span className="listing-source">{sourceName(l.sourceId)} · {countries[l.country] || l.country}{l.condition !== 'unknown' ? ` · ${l.condition === 'new' ? 'New' : 'Pre-owned'}` : ''}</span>
          <a className="listing-title" href={l.url} target="_blank" rel="noreferrer">{l.title}</a>
          {l.match === 'similar' && <span className="listing-source">{allDials ? 'Another reference' : 'Another dial or reference'} · not in this price</span>}
          {l.match === 'reference' && <span className="listing-source">Ref. {base} · {allDials ? 'any dial' : dialKnown && hasVariants ? `${variants.find((v) => v.id === model.id)?.dial || 'this'} dial` : 'dial/bracelet not stated'}</span>}
          <strong className="listing-price">{l.originalCurrency ? '≈ ' : ''}{money(l.price, l.currency)}<span className={`tag${l.status !== 'asking' ? ' sold-tag' : ''}`}>{l.status === 'confirmed-sale' ? 'Reported sale' : l.status === 'sold-asking' ? 'Sold · last ask' : l.archived ? 'Asking · last observed' : 'Asking'}</span></strong>
          {l.archived && l.lastSeenAt && <span className="listing-source">Last seen {fmtDate(l.lastSeenAt.slice(0, 10))} · availability not reverified</span>}
          {l.priceChanges?.length ? (() => {
            const was = l.priceChanges[l.priceChanges.length - 1], listed = l.originalPrice ?? l.price;
            return <span className="listing-source">{was.price > listed ? 'Reduced' : 'Raised'} from {money(was.price, l.originalCurrency || l.currency)} · {fmtDate(was.date)}{l.priceChanges.length > 1 ? ` · ${l.priceChanges.length} price changes` : ''}</span>;
          })() : null}
          {l.originalCurrency && <span className="listing-source">Listed at {money(l.originalPrice!, l.originalCurrency)} · converted</span>}
          {l.listedAt && <span className="listing-source">{l.sourceId === 'huuto' ? 'Sold listing closed' : l.status === 'confirmed-sale' ? 'Auction ended' : classifieds.has(l.sourceId) && l.sourceId !== 'ebay' ? 'Updated' : 'Listed'} {fmtDate(l.listedAt)}</span>}
          {l.sourceId === 'kellotux' && l.status !== 'asking' && !l.listedAt && <span className="listing-source">Sold status observed {fmtDate(l.observedAt)} · sale date unavailable</span>}
          <div className="listing-actions">
            <a className="secondary" href={l.url} target="_blank" rel="noreferrer">
              View listing <ArrowUpRight size={13} />
            </a>
            {l.match !== 'similar' && (
              <button className="icon-btn" disabled={isSaved || saving === l.url} title={isSaved ? 'Saved to your price history' : 'Save to your price history'} aria-label={isSaved ? 'Saved to your price history' : 'Save to your price history'} onClick={() => save(l)}>
                {isSaved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const family = (model as Model & { family?: string }).family;
  // Checking sources again while older results stay on screen.
  const refreshing = liveState === 'loading' && Boolean(live);
  const okSources = live?.sources.filter((s) => s.status === 'ok').length ?? 0;
  const chrono24Url = live?.sources.find((x) => x.id === 'chrono24')?.searchUrl;
  const regionName = regions.find(([r]) => r === prefs.region)?.[1];

  return (
    <div className="detail">
      <header className="detail-head">
        <div>
          <p className="detail-name">{model.brand} {family || model.name}</p>
          <h1>Ref. {model.reference}</h1>
        </div>
        <div className="detail-actions">
          <FavoriteButton modelId={model.id} label />
          <button className="primary" onClick={() => onModal('owned')}><Plus size={15} />Add to my watches</button>
          <button className="secondary" onClick={() => onModal('observation')}>Record a price</button>
        </div>
      </header>

      <section className="detail-hero">
        <div className="detail-gallery">
          <div className="detail-photo">
            <WatchPhoto key={model.imageUrl || model.id} model={model} iconSize={70} cutout />
            {owned.length > 0 && <span className="owned-tag">In my watches</span>}
          </div>
          {variants.length > 1 ? (
            <div className="dial-scope">
              <div className="dial-switch" role="group" aria-label="Which dials the prices cover">
                <button className={allDials ? 'active' : ''} aria-pressed={allDials} onClick={() => onPrefs({ ...prefs, dialScope: 'all' })}>
                  <span className="all-dials-icon" aria-hidden>{variants.slice(0, 4).map((v) => <i key={v.id} style={{ background: (v.dial && dialSwatch[v.dial]) || '#bbb' }} />)}</span>
                  <span><strong>All dials</strong><small>{variants.length} variants of Ref. {base}</small></span>
                </button>
                <button className={!allDials ? 'active' : ''} aria-pressed={!allDials} aria-haspopup="dialog" onClick={() => setDialsOpen(true)}>
                  {!allDials && currentVariant ? <span className="variant-thumb small"><WatchPhoto model={currentVariant} credit={false} iconSize={14} /></span> : <span className="dial-pick-icon" aria-hidden><ChevronsRight size={15} /></span>}
                  <span><strong>{!allDials && currentVariant ? currentVariant.label : 'Choose a dial'}</strong><small>{!allDials ? 'This dial only · change' : 'Price one dial'}</small></span>
                  <ChevronRight size={15} />
                </button>
              </div>
              {allDials && (
                <dl className="dial-summary" aria-busy={liveState === 'loading'}>
                  <div><dt>Used price range</dt><dd>{liveState === 'loading' && !live ? <span className="skeleton-line" style={{ width: 120 }} /> : priceRange(allUsed)}</dd><small>{allUsed.length} listing{allUsed.length === 1 ? '' : 's'} · {rangeLabel}</small></div>
                  <div><dt>New price range</dt><dd>{liveState === 'loading' && !live ? <span className="skeleton-line" style={{ width: 120 }} /> : priceRange(allNew)}</dd><small>{allNew.length} shop website{allNew.length === 1 ? '' : 's'}, cheapest offer each</small></div>
                  <div><dt>Cheapest sale · 5 years</dt><dd>{allSold.length ? money(allSold[0], prefs.currency) : '–'}</dd><small>{allSold.length} sale{allSold.length === 1 ? '' : 's'} recorded</small></div>
                  <div><dt>Median used sale · 5 years</dt><dd>{allSold.length ? money(median(allSold), prefs.currency) : '–'}</dd><small>sold listings and auction results</small></div>
                </dl>
              )}
            </div>
          ) : (
            family && <p className="detail-variant">{model.name}{model.size ? ` · ${model.size}` : ''}</p>
          )}
        </div>

        <div className="detail-info">
          <div className={`price-box${liveState === 'loading' ? ' is-refreshing' : ''}`} aria-busy={liveState === 'loading'}>
            <div className="price-row">
              <div>
                <h3>Official retail (MSRP) <span className="info" title="Official list price entered or saved by you. It is used for value retention; current shop selling prices are shown separately." role="img" aria-label="About retail price"><Info size={13} /></span></h3>
                <p>
                  {retail?.data.url ? (
                    <a href={retail.data.url} target="_blank" rel="noreferrer">{retail.data.source || 'Brand site'} <ArrowUpRight size={11} /></a>
                  ) : (
                    'Price from authorized retailer'
                  )}
                </p>
              </div>
              {retailEdit ? (
                <form className="retail-form" onSubmit={(e) => { e.preventDefault(); saveRetail(); }}>
                  <input autoFocus type="number" min="1" step="1" placeholder={`Retail in ${prefs.currency}`} value={retailInput} onChange={(e) => setRetailInput(e.target.value)} />
                  <button className="primary" disabled={!(Number(retailInput) > 0)}>Save</button>
                  <button type="button" className="text-btn" onClick={() => setRetailEdit(false)}>Cancel</button>
                </form>
              ) : retail ? (
                <div className="price-value">
                  <strong><BadgeCheck size={20} className="retail-check" />{money(retail.data.price, retail.data.currency)}</strong>
                  <small>
                    as of {fmtDate(retail.data.asOf)} · <button className="text-btn" onClick={() => { setRetailInput(String(retail.data.price)); setRetailEdit(true); }}>Edit</button>
                  </small>
                </div>
              ) : (
                <div className="retail-actions">
                  <a className="secondary" href={retailLookupUrl(model.brand, baseReference(model.reference))} target="_blank" rel="noreferrer" title="Open the model on the brand's site, then click Save to WatchLedger">
                    Find on {brandSiteFor(model.brand) || 'the web'} <ArrowUpRight size={13} />
                  </a>
                  <button className="text-btn" onClick={() => setRetailEdit(true)}><Plus size={13} />Enter</button>
                </div>
              )}
            </div>
            <div className="price-row">
              <div>
                <h3>Shop price (new)</h3>
                <p>{cheapestShop ? `Average of ${currentShopOffers.length} website${currentShopOffers.length === 1 ? '' : 's'}, cheapest offer each${allDials ? ' · all dials' : ''}` : liveState === 'loading' ? 'Checking watch shops…' : 'Not for sale new at the checked shops'}</p>
                {(cheapestShop || allSites.gone.length > 0) && <button className="text-btn new-price-open" onClick={() => setNewOpen(true)}>See prices and places <ChevronRight size={13} /></button>}
              </div>
              <div className="price-value">
                {liveState === 'loading' && !cheapestShop ? <span className="skeleton-line big" aria-label="Loading shop prices" /> : cheapestShop && shopAverage !== null ? <><strong className={refreshing ? 'updating' : ''}>{money(shopAverage, prefs.currency)}</strong><small>lowest {money(cheapestShop.price, prefs.currency)} at {sourceName(cheapestShop.sourceId)}</small></> : <strong>—</strong>}
              </div>
            </div>
            <div className="price-row market">
              <div>
                <h3>Market price <span className="info" title={marketBasis || 'Median of asking and sold prices for this reference in the selected currency, region and time range. Cross-posts count once; far-off prices are excluded.'} role="img" aria-label="How the market price is calculated"><Info size={13} /></span></h3>
                <p>{liveState === 'loading' && marketPrice === null ? 'Checking marketplaces…' : marketPrice === null ? (hasVariants && !allDials ? 'No prices for this dial yet' : 'No prices found yet') : `Asking prices and published sales${hasVariants ? (allDials ? ' · all dials' : ' · this dial') : ''}`}</p>
              </div>
              <div className="price-value">
                {liveState === 'loading' && marketPrice === null ? <span className="skeleton-line big" aria-label="Loading market price" /> : <strong className={`big${refreshing ? ' updating' : ''}`}>{money(marketPrice, prefs.currency)}</strong>}
                {marketPrice !== null && <small>as of {fmtDate(today())} · {pool.length} price{pool.length === 1 ? '' : 's'}</small>}
              </div>
            </div>
            {soldPrice !== null && (
              <div className="price-foot">
                <BadgeCheck size={16} />
                <span>Reported sales <strong>{money(soldPrice, prefs.currency)}</strong> ({prefs.method} of {reportedSales.length} result{reportedSales.length === 1 ? '' : 's'}{lastSold ? `, latest observation ${fmtDate(lastSold)}` : ''})</span>
              </div>
            )}
            {soldAskPrice !== null && <div className="price-foot"><span>Sold · last ask <strong>{money(soldAskPrice, prefs.currency)}</strong> ({soldAsks.length} listing{soldAsks.length === 1 ? '' : 's'} · final deal amount unknown)</span></div>}
            {metrics.dealerPrice !== null && (
              <div className="price-foot">
                <Store size={16} />
                <span>Expect to pay <strong>{money(metrics.dealerPrice, prefs.currency)}</strong> when buying from a dealer</span>
              </div>
            )}
          </div>

          {(metrics.newPremium !== null || metrics.noBoxDiscount !== null || metrics.change1y !== null) && (
            <div className="premium-chips">
              {metrics.newPremium !== null && <span className={metrics.newPremium >= 0 ? 'up' : 'down'}>{metrics.newPremium >= 0 ? '+' : ''}{(metrics.newPremium * 100).toFixed(1)}% in new condition</span>}
              {metrics.noBoxDiscount !== null && <span className={metrics.noBoxDiscount >= 0 ? 'up' : 'down'}>{metrics.noBoxDiscount >= 0 ? '+' : ''}{(metrics.noBoxDiscount * 100).toFixed(1)}% without box/papers</span>}
              {metrics.change1y !== null && <span className={metrics.change1y >= 0 ? 'up' : 'down'}>{metrics.change1y >= 0 ? '+' : ''}{(metrics.change1y * 100).toFixed(1)}% over 1 year</span>}
            </div>
          )}

          <div className="history-card">
            <div className="region-tabs" role="tablist" aria-label="Region">
              {regions.map(([v, l]) => (
                <button key={v} role="tab" aria-selected={prefs.region === v} className={prefs.region === v ? 'active' : ''} onClick={() => onPrefs({ ...prefs, region: v })}>{l}</button>
              ))}
            </div>
            <div className="period-tabs inline" role="tablist" aria-label="Time range">
              {periods.map(([v, l]) => (
                <button key={v} role="tab" aria-selected={prefs.period === v} className={prefs.period === v ? 'active' : ''} onClick={() => onPrefs({ ...prefs, period: v })}>{l}</button>
              ))}
            </div>
            {liveState === 'loading' && !live ? <div className="skeleton-chart" aria-label="Loading price history" /> : <PriceHistory prices={historyPrices} currency={prefs.currency} period={prefs.period} method={prefs.method} />}
          </div>

          <div className="detail-status" role="status">
            <span className={`live-dot ${liveState}`} />
            <span>
              {liveState === 'loading'
                ? 'Checking marketplaces…'
                : liveState === 'error'
                  ? liveError
                  : <>Updated {live && ago(live.fetchedAt)} from {okSources} sources{live?.refreshing && ' · checking for newer prices…'}{otherCurrency > 0 && <> · <button className="text-btn" onClick={() => onPrefs({ ...prefs, currency: topOther })}>{otherCurrency} more in {topOther}</button></>}</>}
            </span>
            {live && <button className="text-btn" aria-expanded={showSources} onClick={() => setShowSources((v) => !v)}>Sources <ChevronDown size={13} className={showSources ? 'rot' : ''} /></button>}
            {liveState !== 'loading' && signedIn && <button className="text-btn" onClick={() => loadLive(true)}><RefreshCw size={13} />Refresh</button>}
          </div>
          {showSources && live && (
            <div className="source-chips">
              {live.sources.map((src) => (
                <span key={src.id} className={`source-chip ${src.status}`} title={src.message}>
                  <span className="dot" />
                  {src.name}
                  <small>{src.status === 'ok' ? src.count : src.status === 'blocked' ? 'blocked' : src.status === 'credentials_required' ? 'not connected' : 'error'}</small>
                  {src.searchUrl && src.status !== 'ok' && <a href={src.searchUrl} target="_blank" rel="noreferrer" aria-label={`Search ${src.name}`}><ArrowUpRight size={12} /></a>}
                </span>
              ))}
              {groupSources.map((g) => {
                const href = facebookGroupSearchUrl(g.url || '', `${model.brand} ${baseReference(model.reference)}`);
                return href ? (
                  <span key={g.id} className="source-chip blocked" title="Facebook has no API for groups. Search the group, then save posts with the Save to WatchLedger button.">
                    <span className="dot" />
                    {g.name}
                    <a href={href} target="_blank" rel="noreferrer" aria-label={`Search ${g.name}`}><ArrowUpRight size={12} /></a>
                  </span>
                ) : null;
              })}
              {convertedCount > 0 && fx && <p className="fine">Other currencies converted at ECB rates of {fx.date}.</p>}
            </div>
          )}
        </div>
      </section>

      <section className={`panel chart-card${liveState === 'loading' ? ' is-refreshing' : ''}`} aria-busy={liveState === 'loading'}>
        <div className="chart-card-head">
          <h2>Charts &amp; metrics</h2>
          <button className="text-btn" onClick={() => setSpecsOpen(true)}>Model specifications <ChevronsRight size={15} /></button>
        </div>
        <div className="chart-tabs" role="tablist" aria-label="Chart">
          {([['listings', 'Listings'], ['volume', 'Volume'], ['days', 'Days on market']] as const).map(([v, l]) => (
            <button key={v} role="tab" aria-selected={chartTab === v} className={chartTab === v ? 'active' : ''} onClick={() => setChartTab(v)}>{l}</button>
          ))}
        </div>
        {chartTab === 'listings' && (
          <>
            <div className="chart-controls">
              {sourcesInChart.length > 0 && (
                <div className="source-toggle" role="group" aria-label="Show only one source (⌘/Ctrl/Shift-click to add or remove one)">
                  <span className="legend-label" aria-hidden>Source</span>
                  {sourcesInChart.map(({ name, n }) => (
                    <button
                      key={name}
                      aria-pressed={!hiddenSources.has(name)}
                      className={hiddenSources.has(name) ? 'off' : ''}
                      title={`Show only ${name}; click again to show all. ⌘/Ctrl/Shift-click adds or removes it.`}
                      onClick={(e) =>
                        setHiddenSources((h) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey) {
                            const x = new Set(h);
                            if (x.has(name)) x.delete(name);
                            else x.add(name);
                            return x;
                          }
                          // Clicking the only visible source shows them all again; otherwise show just this one.
                          const soloed = !h.has(name) && sourcesInChart.every((s) => s.name === name || h.has(s.name));
                          return soloed ? new Set() : new Set(sourcesInChart.map((s) => s.name).filter((x) => x !== name));
                        })
                      }
                    >
                      <span className="dot" style={{ '--dot': chartColors[name] } as React.CSSProperties} />
                      {name}
                      <small>{n}</small>
                    </button>
                  ))}
                </div>
              )}
              <button className="text-btn" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>Filters <ChevronDown size={13} className={showFilters ? 'rot' : ''} /></button>
            </div>
            {showFilters && <FilterBar prefs={prefs} onPrefs={onPrefs} extended />}
            {chartPoints.length ? (
              <>
                <PriceScatter points={chartPoints} currency={prefs.currency} period={prefs.period} marketPrice={marketPrice} colors={chartColors} />
                {hiddenOutliers > 0 && <p className="fine">{hiddenOutliers} far-off price{hiddenOutliers === 1 ? '' : 's'} hidden (also excluded from the market price).</p>}
              </>
            ) : (
              liveState === 'loading' ? (
                <div className="skeleton-chart" aria-label="Loading prices" />
              ) : (
                <div className="chart-empty">
                  <div className="empty-chart-lines" />
                  <h3>No prices for these filters yet</h3>
                </div>
              )
            )}
          </>
        )}
        {chartTab === 'volume' && <VolumeChart period={prefs.period} points={metricPrices.filter((p) => prefs.period === '36500' || p.date >= periodStart(prefs.period)).map((p) => ({ date: p.date, sold: p.status !== 'asking' }))} />}
        {chartTab === 'days' && <DaysChart ages={ages} />}
        <div className={liveState === 'loading' && !live ? 'metrics-loading' : ''}>
        <MetricsGrid m={metrics} hasRetail={Boolean(retail)} onRetail={() => { setRetailEdit(true); scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </div>
      </section>

      <section className={`panel${liveState === 'loading' ? ' is-refreshing' : ''}`} aria-busy={liveState === 'loading'}>
        <div className="section-head">
          <h2>Listings <span className="count-pill">{exactIn.length}</span></h2>
        </div>
        {liveState === 'loading' && !live ? (
          <div className="listing-grid">{Array.from({ length: 4 }, (_, i) => <div key={i} className="listing skeleton" />)}</div>
        ) : exactIn.length ? (
          <div className="listing-grid">{sortedExact.map((l) => <ListingCard key={l.url} l={l} />)}</div>
        ) : (
          <p className="muted-line">No listings for this reference in {prefs.currency}{prefs.region !== 'Global' ? ` in ${regionName}` : ''}.</p>
        )}
        {(similarIn.length > 0 || (live?.threads?.length ?? 0) > 0 || (live?.otherSimilar ?? 0) > 0) && (
          <div className="similar-block">
            <button className="text-btn" aria-expanded={showSimilar} onClick={() => setShowSimilar((v) => !v)}>
              {showSimilar ? 'Hide' : 'Show'} similar listings and unpriced threads ({similarIn.length + (live?.threads?.length ?? 0) + (othersLoaded ? 0 : live?.otherSimilar ?? 0)}) <ChevronRight size={14} className={showSimilar ? 'rot' : ''} />
            </button>
            {showSimilar && (
              <>
                <p className="fine">Similar listings may be another dial, bracelet or reference. They are never used for the market price.</p>
                {othersToLoad && <p className="muted-line">Loading other models…</p>}
                {similarIn.length > 0 && <div className="listing-grid">{similarIn.map((l) => <ListingCard key={l.url} l={l} />)}</div>}
                {(live?.threads?.length ?? 0) > 0 && (
                  <ul className="thread-list">
                    {live!.threads!.map((t) => (
                      <li key={t.url}>
                        <a href={t.url} target="_blank" rel="noreferrer">{t.title} <ArrowUpRight size={12} /></a>
                        <small>{t.source} · {fmtDate(t.date)} · price not in preview</small>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {savedAll.length > 0 && (
        <section className="panel">
          <div className="section-head">
            <h2>Your price records <span className="count-pill">{savedAll.length}</span></h2>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Price</th><th>Type</th><th>Source</th><th>Date</th><th /></tr>
              </thead>
              <tbody>
                {[...savedAll].sort((a, b) => b.data.observedAt.localeCompare(a.data.observedAt)).map((e) => (
                  <tr key={e.id}>
                    <td className="price-cell">{money(e.data.price, e.data.currency)}</td>
                    <td><span className="tag">{statuses[e.data.status]}</span></td>
                    <td>
                      {e.data.url ? <a href={e.data.url} target="_blank" rel="noreferrer">{sourceName(e.data.sourceId)} <ExternalLink size={11} /></a> : sourceName(e.data.sourceId)}
                      <small>{countries[e.data.country]}</small>
                    </td>
                    <td>{e.data.observedAt}</td>
                    <td><button className="icon-btn" aria-label="Remove price record" onClick={() => onRemove(e.id)}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <details className="panel more-panel">
        <summary>More: risk breakdown, prices by region, Chrono24 fees <ChevronDown size={15} /></summary>
        <RiskPanel m={metrics} reference={`${model.brand} ${baseReference(model.reference)}`} />
        <div className="more-grid">
          <div>
            <h3>By region</h3>
            <div className="region-list">
              {regional.map(({ r, name, n, v }) => (
                <button key={r} className={prefs.region === r ? 'active' : ''} onClick={() => onPrefs({ ...prefs, region: prefs.region === r ? 'Global' : r })}>
                  <span>{name}<small>{n} price{n === 1 ? '' : 's'}</small></span>
                  <strong>{money(v, prefs.currency)}</strong>
                </button>
              ))}
            </div>
          </div>
          <div className="fee-card">
            <h3>Chrono24 price after fees</h3>
            <label className="fee-input">
              <span>Listed price ({prefs.currency})</span>
              <input type="number" min="1" step="1" inputMode="numeric" placeholder={marketPrice ? String(Math.round(marketPrice)) : 'e.g. 9000'} value={sellInput} onChange={(e) => setSellInput(e.target.value)} />
            </label>
            {fees && (
              <dl className="fee-rows">
                <div><dt>Chrono24 commission 6.95%</dt><dd className="neg">−{money(fees.commission, prefs.currency)}</dd></div>
                <div className="total"><dt>Seller receives</dt><dd>{money(fees.sellerNet, prefs.currency)}</dd></div>
                <div className="hint"><dt>To receive {money(fees.listed, prefs.currency)}, list at</dt><dd>{money(fees.listToNet, prefs.currency)}</dd></div>
              </dl>
            )}
            {chrono24Url && <a className="text-btn" href={chrono24Url} target="_blank" rel="noreferrer">See this watch on Chrono24 <ArrowUpRight size={13} /></a>}
          </div>
        </div>
      </details>

      {related.length > 0 && (
        <section className="home-section">
          <div className="home-section-head">
            <h2>Related watches</h2>
            <button className="text-btn" onClick={() => onNavigate({ view: 'home', brand: model.brand })}>
              More {model.brand} <ChevronRight size={14} />
            </button>
          </div>
          <div className="tile-row">
            {related.map((m) => (
              <WatchCard key={m.id} model={m} onOpen={() => onNavigate({ view: 'watch', id: m.id })} />
            ))}
          </div>
        </section>
      )}

      {/* Cards show the default view (1 year, all world, all dials, median); save this page's price only when it matches. */}
      {liveState === 'ready' && marketPrice !== null && prefs.region === 'Global' && prefs.period === '365' && prefs.method === 'median' && prefs.basis === 'all' && prefs.condition === 'all' && prefs.seller === 'all' && (!hasVariants || allDials) && (
        <RememberPrice id={model.id} market={{ price: Math.round(marketPrice), currency: prefs.currency, count: pool.length }} />
      )}
      {dialsOpen && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setDialsOpen(false)}>
          <section className="modal dials-modal" role="dialog" aria-modal="true" aria-labelledby="dials-title">
            <button className="close icon-btn" aria-label="Close dialog" onClick={() => setDialsOpen(false)}><X size={21} /></button>
            <h2 id="dials-title">Choose a dial · Ref. {base}</h2>
            <p className="modal-sub">Average second-hand price and new shop price per dial ({rangeLabel}, {prefs.currency}). Choosing a dial prices that dial only.</p>
            {variants.length > 8 && <input className="variant-search" type="search" autoFocus aria-label="Search dials and bracelets" placeholder="Search dials, bracelets or reference…" value={variantQuery} onChange={(e) => setVariantQuery(e.target.value)} />}
            <div className="variant-grid" role="group" aria-label="Dials and bracelets">
              {shownVariants.map((v) => { const dp = dialPrices(v); return (
                <button key={v.id} className={!allDials && v.id === model.id ? 'active' : ''} aria-pressed={!allDials && v.id === model.id} title={`${v.label} · Ref. ${v.reference}\nSecond-hand average: ${dp.used === null ? 'no prices' : `${money(dp.used, prefs.currency)} (${dp.usedN})`}\nShop new average: ${dp.fresh === null ? 'no offers' : `${money(dp.fresh, prefs.currency)} (${dp.freshN} website${dp.freshN === 1 ? '' : 's'})`}`} onClick={() => { if (prefs.dialScope !== 'dial') onPrefs({ ...prefs, dialScope: 'dial' }); setDialsOpen(false); if (v.id !== model.id) onNavigate({ view: 'watch', id: v.id }); }}>
                  <span className="variant-thumb"><WatchPhoto model={v} credit={false} iconSize={16} /></span>
                  <span className="variant-name">
                    {v.dial && <i className="swatch" style={{ background: dialSwatch[v.dial] || '#999' }} />}
                    {v.label}
                  </span>
                  <small>{v.reference}</small>
                  {dialPrice(dp.used, dp.fresh)}
                </button>
              ); })}
            </div>
            {shownVariants.length === 0 && <p className="muted-line">No matching dial or bracelet. Try a colour, Palm, fluted motif or reference.</p>}
          </section>
        </div>
      )}
      {newOpen && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setNewOpen(false)}>
          <section className="modal new-price-modal" role="dialog" aria-modal="true" aria-labelledby="new-price-title">
            <button className="close icon-btn" aria-label="Close dialog" onClick={() => setNewOpen(false)}><X size={21} /></button>
            <h2 id="new-price-title">New price · Ref. {model.reference}</h2>
            <p className="modal-sub">Where it is for sale new: one offer per website (its cheapest), prices in {prefs.currency}.</p>
            <div className="region-tabs" role="tablist" aria-label="Region">
              {newRegions.map(([r, label]) => {
                const { current } = sitesIn(r), value = average(current);
                return (
                  <button key={r} role="tab" aria-selected={newRegion === r} className={newRegion === r ? 'active' : ''} onClick={() => setNewRegion(r)}>
                    {label}
                    <small>{value === null ? 'none' : `${money(value, prefs.currency)} · ${current.length}`}</small>
                  </button>
                );
              })}
            </div>
            {newSites.current.length ? (
              <div className="shop-offers">{newSites.current.map((l) => shopOfferRow(l, newRegion))}</div>
            ) : (
              <p className="muted-line">Not for sale new {newRegion === 'Global' ? 'at the checked shops' : `in ${newRegions.find(([r]) => r === newRegion)?.[1]}`} right now.</p>
            )}
            {newSites.gone.length > 0 && (
              <div className="similar-block">
                <button className="text-btn" aria-expanded={showGoneOffers} onClick={() => setShowGoneOffers((v) => !v)}>
                  {showGoneOffers ? 'Hide' : 'Show'} {newSites.gone.length} no longer listed <ChevronRight size={14} className={showGoneOffers ? 'rot' : ''} />
                </button>
                {showGoneOffers && <div className="shop-offers">{newSites.gone.map((l) => shopOfferRow(l))}</div>}
              </div>
            )}
            <p className="fine">Checked: eBay dealers (US, EU, Asia), Laatukellot and Keskisen Kello (Finland). Shop asking prices, not official retail.</p>
          </section>
        </div>
      )}
      {specsOpen && <ModelSpecs model={model} onClose={() => setSpecsOpen(false)} onOpen={(id) => { setSpecsOpen(false); onNavigate({ view: 'watch', id }); }} />}
    </div>
  );
}
