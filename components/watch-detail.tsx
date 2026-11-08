'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck, Bookmark, BookmarkCheck, ChevronDown, ChevronRight, ChevronsRight, ExternalLink, Info, Plus, RefreshCw, Store, Trash2, Watch } from 'lucide-react';
import { brandSiteFor, convertPrice, countries, facebookGroupSearchUrl, feeBreakdown, inRegion, retailLookupUrl, latestListings, money, summarize, type Entry, type Model, type Observation } from '../lib/market';
import FilterBar from './filter-bar';
import { baseReference } from '../lib/collectors/matching/reference';
import { exactMatch } from '../lib/collectors/matching/classify';
import { expectedDial, namesDial } from '../lib/collectors/matching/dial';
import { listingKind } from '../lib/market-archive/listings';
import PriceScatter, { type ChartPoint } from './price-scatter';
import PriceHistory from './price-history';
import { DaysChart, MetricsGrid, RiskPanel, VolumeChart } from './market-charts';
import { computeMetrics, dedupeCrossPosts, withoutOutliers, type MetricPrice } from '../lib/metrics';
import ModelSpecs from './model-specs';
import { FavoriteButton } from './favorites';
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
  const [allVariants, setAllVariants] = useState(false);

  useEffect(() => {
    if (model) return;
    fetch(`/api/catalog?ids=${encodeURIComponent(modelId)}`)
      .then((r) => r.json())
      .then((d: any) => (d.items?.length ? onModels(d.items) : setMissing(true)))
      .catch(() => setMissing(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId, model]);

  const loadLive = useCallback(
    (refresh = false) => {
      setLiveState('loading');
      setLiveError('');
      return fetch(`/api/market/live?${new URLSearchParams({ modelId, refresh: refresh ? '1' : '0' })}`)
        .then(async (r) => {
          const d: any = await r.json();
          if (!r.ok) throw new Error(d.error || 'Live prices unavailable');
          setLive(d);
          setLiveState('ready');
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
  }, [modelId, loadLive, signedIn]);

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
  const listings: LiveListing[] = (live?.listings || []).flatMap((l) => {
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
  const allDials = hasVariants && prefs.dialScope !== 'dial';
  const dialKnown = expectedDial(model.name).size === 1;
  const counts = (l: LiveListing) =>
    allDials
      ? l.match !== 'similar' || exactMatch(l.title, { brand: model.brand, reference: base }, l.matchDetails)
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
  const classifieds = new Set(['tori', 'finn', 'blocket', 'dba', 'ebay']);
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
  const marketPrice = summarize(pool.map((p) => p.price), prefs.method);
  const soldPrice = summarize(soldPool.map((p) => p.price), prefs.method);
  const lastSold = soldPool.map((p) => p.date).sort().at(-1) || null;
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
  const metrics = computeMetrics(metricPrices, { retail: retail?.data.price ?? null, market: marketPrice });
  const ages = metricPrices.filter((p) => p.active && p.listedAt).map((p) => Math.round((Date.now() - +new Date(p.listedAt + 'T12:00:00Z')) / 86_400_000));
  const sourcesInChart = [...new Set(points.map((p) => p.source))].map((name) => ({ name, n: points.filter((p) => p.source === name).length }));
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
          {l.originalCurrency && <span className="listing-source">Listed at {money(l.originalPrice!, l.originalCurrency)} · converted</span>}
          {l.listedAt && <span className="listing-source">{l.status === 'confirmed-sale' ? 'Auction ended' : classifieds.has(l.sourceId) && l.sourceId !== 'ebay' ? 'Updated' : 'Listed'} {new Date(l.listedAt + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
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
            <WatchPhoto key={model.imageUrl || model.id} model={model} iconSize={70} />
            {owned.length > 0 && <span className="owned-tag">In my watches</span>}
          </div>
          {variants.length > 1 ? (
            <div className="variant-picker">
              <p className="variant-head">
                <span>{allDials ? `All dials · Ref. ${base}` : variants.find((v) => v.id === model.id)?.label || model.name}</span>
                <small>{allDials ? 'Pick a dial for its own price' : `${variants.length} variants`}</small>
              </p>
              <div className="variant-grid">
                <button className={`all-dials${allDials ? ' active' : ''}`} aria-pressed={allDials} title={`Price across all ${variants.length} variants of Ref. ${base}`} onClick={() => onPrefs({ ...prefs, dialScope: 'all' })}>
                  <span className="variant-thumb"><span className="all-dials-icon">{variants.slice(0, 4).map((v) => <i key={v.id} style={{ background: (v.dial && dialSwatch[v.dial]) || '#bbb' }} />)}</span></span>
                  <span className="variant-name">All dials</span>
                </button>
                {(allVariants ? variants : variants.slice(0, 11)).map((v) => (
                  <button key={v.id} className={!allDials && v.id === model.id ? 'active' : ''} aria-pressed={!allDials && v.id === model.id} title={`${v.label} · Ref. ${v.reference}`} onClick={() => { if (prefs.dialScope !== 'dial') onPrefs({ ...prefs, dialScope: 'dial' }); if (v.id !== model.id) onNavigate({ view: 'watch', id: v.id }); }}>
                    <span className="variant-thumb"><WatchPhoto model={v} credit={false} iconSize={16} /></span>
                    <span className="variant-name">
                      {v.dial && <i className="swatch" style={{ background: dialSwatch[v.dial] || '#999' }} />}
                      {v.label}
                    </span>
                  </button>
                ))}
              </div>
              {variants.length > 11 && <button className="text-btn" onClick={() => setAllVariants((x) => !x)}>{allVariants ? 'Show fewer' : `Show all ${variants.length}`}</button>}
            </div>
          ) : (
            family && <p className="detail-variant">{model.name}{model.size ? ` · ${model.size}` : ''}</p>
          )}
        </div>

        <div className="detail-info">
          <div className="price-box">
            <div className="price-row">
              <div>
                <h3>Retail price <span className="info" title="Price from an authorized retailer. Enter it yourself; it is used for value retention." role="img" aria-label="About retail price"><Info size={13} /></span></h3>
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
            <div className="price-row market">
              <div>
                <h3>Market price <span className="info" title={marketBasis || 'Median of asking and sold prices for this reference in the selected currency, region and time range. Cross-posts count once; far-off prices are excluded.'} role="img" aria-label="How the market price is calculated"><Info size={13} /></span></h3>
                <p>{liveState === 'loading' && marketPrice === null ? 'Checking marketplaces…' : marketPrice === null ? (hasVariants && !allDials ? 'No prices for this dial yet' : 'No prices found yet') : `Estimated private sale price${hasVariants ? (allDials ? ' · all dials' : ' · this dial') : ''}`}</p>
              </div>
              <div className="price-value">
                <strong className="big">{liveState === 'loading' && marketPrice === null ? '…' : money(marketPrice, prefs.currency)}</strong>
                {marketPrice !== null && <small>as of {fmtDate(today())} · {pool.length} price{pool.length === 1 ? '' : 's'}</small>}
              </div>
            </div>
            {soldPrice !== null && (
              <div className="price-foot">
                <BadgeCheck size={16} />
                <span>Sold for <strong>{money(soldPrice, prefs.currency)}</strong> ({prefs.method} of {soldPool.length} sale{soldPool.length === 1 ? '' : 's'}{lastSold ? `, last ${fmtDate(lastSold)}` : ''})</span>
              </div>
            )}
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
            <PriceHistory prices={historyPrices} currency={prefs.currency} period={prefs.period} method={prefs.method} />
          </div>

          <div className="detail-status" role="status">
            <span className={`live-dot ${liveState}`} />
            <span>
              {liveState === 'loading'
                ? 'Checking marketplaces…'
                : liveState === 'error'
                  ? liveError
                  : <>Updated {live && ago(live.fetchedAt)} from {okSources} sources{otherCurrency > 0 && <> · <button className="text-btn" onClick={() => onPrefs({ ...prefs, currency: topOther })}>{otherCurrency} more in {topOther}</button></>}</>}
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

      <section className="panel chart-card">
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
                <div className="source-toggle" role="group" aria-label="Sources">
                  {sourcesInChart.map(({ name, n }) => (
                    <button key={name} aria-pressed={!hiddenSources.has(name)} className={hiddenSources.has(name) ? '' : 'on'} onClick={() => setHiddenSources((h) => { const x = new Set(h); if (x.has(name)) x.delete(name); else x.add(name); return x; })}>
                      {name} ({n})
                    </button>
                  ))}
                </div>
              )}
              <button className="text-btn" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>Filters <ChevronDown size={13} className={showFilters ? 'rot' : ''} /></button>
            </div>
            {showFilters && <FilterBar prefs={prefs} onPrefs={onPrefs} extended />}
            {chartPoints.length ? (
              <>
                <PriceScatter points={chartPoints} currency={prefs.currency} period={prefs.period} marketPrice={marketPrice} />
                {hiddenOutliers > 0 && <p className="fine">{hiddenOutliers} far-off price{hiddenOutliers === 1 ? '' : 's'} hidden (also excluded from the market price).</p>}
              </>
            ) : (
              <div className="chart-empty">
                <div className="empty-chart-lines" />
                <h3>{liveState === 'loading' ? 'Loading prices…' : 'No prices for these filters yet'}</h3>
              </div>
            )}
          </>
        )}
        {chartTab === 'volume' && <VolumeChart period={prefs.period} points={metricPrices.filter((p) => prefs.period === '36500' || p.date >= periodStart(prefs.period)).map((p) => ({ date: p.date, sold: p.status !== 'asking' }))} />}
        {chartTab === 'days' && <DaysChart ages={ages} />}
        <MetricsGrid m={metrics} hasRetail={Boolean(retail)} onRetail={() => { setRetailEdit(true); scrollTo({ top: 0, behavior: 'smooth' }); }} />
      </section>

      <section className="panel">
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
        {(similarIn.length > 0 || (live?.threads?.length ?? 0) > 0) && (
          <div className="similar-block">
            <button className="text-btn" aria-expanded={showSimilar} onClick={() => setShowSimilar((v) => !v)}>
              {showSimilar ? 'Hide' : 'Show'} similar listings and unpriced threads ({similarIn.length + (live?.threads?.length ?? 0)}) <ChevronRight size={14} className={showSimilar ? 'rot' : ''} />
            </button>
            {showSimilar && (
              <>
                <p className="fine">Similar listings may be another dial, bracelet or reference. They are never used for the market price.</p>
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

      {specsOpen && <ModelSpecs model={model} onClose={() => setSpecsOpen(false)} onOpen={(id) => { setSpecsOpen(false); onNavigate({ view: 'watch', id }); }} />}
    </div>
  );
}
