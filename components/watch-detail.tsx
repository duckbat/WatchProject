'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck, Bookmark, BookmarkCheck, ChevronRight, ExternalLink, Info, Pencil, Plus, RefreshCw, Store, Trash2, Watch } from 'lucide-react';
import { brandSiteFor, convertPrice, countries, facebookGroupSearchUrl, feeBreakdown, inRegion, retailLookupUrl, latestListings, money, summarize, type Entry, type Model, type Observation } from '../lib/market';
import FilterBar from './filter-bar';
import { baseReference } from '../lib/collectors';
import { listingKind } from '../lib/listing-archive';
import PriceScatter, { type ChartPoint } from './price-scatter';
import PriceHistory from './price-history';
import { DaysChart, MetricsGrid, RiskPanel, VolumeChart } from './market-charts';
import { computeMetrics, type MetricPrice } from '../lib/metrics';
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

  useEffect(() => {
    if (!model) return;
    const line = model.name.split(/[\s/]+/).slice(0, /^\d{2}/.test(model.name.split(/\s+/)[1] || '') ? 2 : 1).join(' ');
    fetch(`/api/catalog?${new URLSearchParams({ q: line, brand: model.brand, limit: '9' })}`)
      .then((r) => r.json())
      .then((d: any) => setRelated((d.items || []).filter((m: Model) => m.id !== model.id).slice(0, 8)))
      .catch(() => setRelated([]));
  }, [model]);

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
  const savedPrice = summarize(latestListings(savedShown).map((e) => e.data.price), prefs.method);
  const listings: LiveListing[] = (live?.listings || []).flatMap((l) => {
    const p = toCur(l.price, l.currency);
    return p === null ? [] : [l.currency === prefs.currency ? l : { ...l, price: Math.round(p), currency: prefs.currency, originalPrice: l.price, originalCurrency: l.currency }];
  });
  const convertedCount = listings.filter((l) => l.originalCurrency && l.match === 'exact').length + saved.filter((e) => (e.data as any).originalCurrency).length;
  const liveIn = (l: LiveListing) => l.currency === prefs.currency && inRegion(l.country, prefs.region) && (prefs.condition === 'all' || l.condition === prefs.condition) && (prefs.seller === 'all' || l.sellerType === prefs.seller) && (prefs.basis === 'all' || l.status === prefs.basis) && l.observedAt >= periodStart(prefs.period);
  const exact = listings.filter((l) => l.match === 'exact');
  const similar = listings.filter((l) => l.match === 'similar');
  const exactIn = exact.filter(liveIn);
  const similarIn = similar.filter(liveIn);
  // Market price: asking AND sold prices for this exact reference (independent of the price-type chart filter).
  const inScope = (o: { currency: string; country: string; condition: string; sellerType: string }) =>
    o.currency === prefs.currency && inRegion(o.country, prefs.region) && (prefs.condition === 'all' || o.condition === prefs.condition) && (prefs.seller === 'all' || o.sellerType === prefs.seller);
  const periodOk = (d: string) => prefs.period === '36500' || d >= periodStart(prefs.period);
  const isSold = (status: string) => status === 'sold-asking' || status === 'confirmed-sale';
  const exactUrls = new Set(exact.map((l) => l.url));
  const pool = [
    // Active marketplace listings count as current; forum posts count on their post date.
    ...exact.map((l) => ({ ...l, date: l.status === 'asking' && (l.sourceId === 'tori' || l.sourceId === 'ebay') ? l.observedAt : l.listedAt || l.observedAt })).filter((l) => inScope(l) && periodOk(l.date)).map((l) => ({ price: l.price, status: l.status, date: l.date, converted: Boolean(l.originalCurrency) })),
    ...latestListings(saved.filter((e) => inScope(e.data) && periodOk(e.data.observedAt) && !(e.data.url && exactUrls.has(e.data.url)))).map((e) => ({ price: e.data.price, status: e.data.status, date: e.data.observedAt, converted: Boolean((e.data as any).originalCurrency) })),
  ];
  const soldPool = pool.filter((p) => isSold(p.status));
  const marketPrice = summarize(pool.map((p) => p.price), prefs.method);
  const soldPrice = summarize(soldPool.map((p) => p.price), prefs.method);
  const lastSold = soldPool.map((p) => p.date).sort().at(-1) || null;
  const rangeLabel = periods.find(([v]) => v === prefs.period)?.[1];
  const nConverted = pool.filter((p) => p.converted).length;
  const marketBasis = pool.length
    ? `${prefs.method === 'median' ? 'Median' : 'Average'} of ${pool.length} price${pool.length === 1 ? '' : 's'} (${pool.length - soldPool.length} asking · ${soldPool.length} sold) · ${rangeLabel}${nConverted ? ` · ${nConverted} converted to ${prefs.currency}` : ''}`
    : '';
  const lows = exactIn.map((l) => l.price);
  const otherCurrencies = (live?.listings || []).filter((l) => l.match === 'exact' && !listings.some((x) => x.url === l.url)).map((l) => l.currency);
  const otherCurrency = otherCurrencies.length;
  const topOther = otherCurrencies.sort((a, b) => otherCurrencies.filter((x) => x === b).length - otherCurrencies.filter((x) => x === a).length)[0];
  const sellPrice = Number(sellInput) > 0 ? Number(sellInput) : marketPrice;
  const fees = sellPrice ? feeBreakdown(sellPrice, 'chrono24') : null;
  const sortedExact = [...exactIn].sort((a, b) => (b.listedAt || b.observedAt).localeCompare(a.listedAt || a.observedAt));
  const liveUrls = new Set(exactIn.map((l) => l.url));
  const historyPrices = [
    ...savedShown.filter((e) => !liveUrls.has(e.data.url)).map((e) => ({ date: e.data.observedAt, price: e.data.price })),
    ...exactIn.map((l) => ({ date: l.listedAt || l.observedAt, price: l.price })),
  ].filter((p) => prefs.period === '36500' || p.date >= periodStart(prefs.period));
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
    ...exact.filter((l) => l.currency === prefs.currency && regionOk(l.country)).map((l) => ({ date: l.listedAt || l.observedAt, price: l.price, status: l.status, condition: l.condition, contents: l.contents, sellerType: l.sellerType, active: !l.archived && l.status === 'asking' && (l.sourceId === 'tori' || l.sourceId === 'ebay'), listedAt: l.listedAt })),
  ];
  const retails = entries.filter((e) => e.kind === 'retail' && e.data.modelId === modelId).sort((a, b) => String(b.data.asOf).localeCompare(String(a.data.asOf)));
  const retail = retails.find((e) => e.data.currency === prefs.currency);
  const metrics = computeMetrics(metricPrices, { retail: retail?.data.price ?? null, market: marketPrice });
  const ages = metricPrices.filter((p) => p.active && p.listedAt).map((p) => Math.round((Date.now() - +new Date(p.listedAt + 'T12:00:00Z')) / 86_400_000));
  const sourcesInChart = [...new Set(points.map((p) => p.source))].map((name) => ({ name, n: points.filter((p) => p.source === name).length }));
  const chartPoints = points.filter((p) => !hiddenSources.has(p.source));
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
          {l.match === 'similar' && <span className="listing-source">Not an exact variant match · excluded from market price</span>}
          <strong className="listing-price">{l.originalCurrency ? '≈ ' : ''}{money(l.price, l.currency)}<span className={`tag${l.status !== 'asking' ? ' sold-tag' : ''}`}>{l.status === 'confirmed-sale' ? 'Reported sale' : l.status === 'sold-asking' ? 'Sold · last ask' : l.archived ? 'Asking · last observed' : 'Asking'}</span></strong>
          {l.archived && l.lastSeenAt && <span className="listing-source">Last seen {fmtDate(l.lastSeenAt.slice(0, 10))} · availability not reverified</span>}
          {l.originalCurrency && <span className="listing-source">Listed at {money(l.originalPrice!, l.originalCurrency)} · converted</span>}
          {l.listedAt && <span className="listing-source">{l.status === 'confirmed-sale' ? 'Auction ended' : l.sourceId === 'tori' ? 'Updated' : 'Listed'} {new Date(l.listedAt + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
          <div className="listing-actions">
            <a className="secondary" href={l.url} target="_blank" rel="noreferrer">
              View listing <ArrowUpRight size={13} />
            </a>
            {l.match === 'exact' && (
              <button className="icon-btn" disabled={isSaved || saving === l.url} title={isSaved ? 'Saved to your price history' : 'Save to your price history'} aria-label={isSaved ? 'Saved to your price history' : 'Save to your price history'} onClick={() => save(l)}>
                {isSaved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="detail">
      <nav className="crumbs" aria-label="Breadcrumb">
        <button onClick={() => onNavigate({ view: 'home' })}>Watches</button>
        <ChevronRight size={13} />
        <button onClick={() => onNavigate({ view: 'home', brand: model.brand })}>{model.brand}</button>
        <ChevronRight size={13} />
        <span aria-current="page">Ref. {model.reference}</span>
      </nav>

      <section className="detail-hero">
        <div className="detail-gallery">
          <div className="detail-photo">
            <WatchPhoto key={model.imageUrl || model.id} model={model} iconSize={70} />
            {owned.length > 0 && <span className="owned-tag">In my watches</span>}
          </div>
        </div>

        <div className="detail-info">
          <div className="detail-title">
            <div>
              <p className="eyebrow">{model.brand.toUpperCase()}</p>
              <h1>{model.name}</h1>
              <p className="detail-ref">
                Ref. <strong>{model.reference}</strong>
                {model.size && <> · {model.size}</>}
                {(model as any).family && <> · {(model as any).family}</>}
              </p>
            </div>
            <div className="detail-actions">
              <button className="secondary" onClick={() => onModal('observation')}><Plus size={15} />Record a price</button>
              <button className="primary" onClick={() => onModal('owned')}><Plus size={15} />Add to my watches</button>
            </div>
          </div>

          <div className="price-box">
            <div className="price-row">
              <div>
                <h3>Retail price <span className="info" title="Price from an authorized retailer. Enter it yourself; it is used for value retention." role="img" aria-label="About retail price"><Info size={13} /></span></h3>
                <p>
                  {retail ? (
                    retail.data.url ? <>From <a href={retail.data.url} target="_blank" rel="noreferrer">{retail.data.source || 'brand site'} <ArrowUpRight size={11} /></a> · as of {fmtDate(retail.data.asOf)}</> : <>Entered by you · as of {fmtDate(retail.data.asOf)}</>
                  ) : retails.length ? `Saved in ${retails.map((r) => r.data.currency).join(', ')}; none in ${prefs.currency}` : 'Official price from the brand or an authorized dealer'}
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
                  <button className="text-btn" onClick={() => { setRetailInput(String(retail.data.price)); setRetailEdit(true); }}><Pencil size={12} />Edit</button>
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
                <h3>Market price <span className="info" title="Median (or average) of asking and sold prices for this exact reference in the selected currency, region and time range: live listings, forum posts and your saved prices." role="img" aria-label="About market price"><Info size={13} /></span></h3>
                <p>{marketPrice !== null ? marketBasis : liveState === 'loading' ? 'Checking marketplaces…' : 'No complete-reference matches found'}</p>
              </div>
              <div className="price-value">
                <strong className="big">{liveState === 'loading' && marketPrice === null ? '…' : money(marketPrice, prefs.currency)}</strong>
                <small>as of {fmtDate(today())}</small>
              </div>
            </div>
            <div className="price-row sold">
              <div>
                <h3>Sold price <span className="info" title="Median of prices marked sold: sold r/Watchexchange posts, WatchUSeek SOLD threads, and sales you record or import. A 'sold · last ask' is the asking price of a watch that sold." role="img" aria-label="About sold price"><Info size={13} /></span></h3>
                <p>{soldPool.length ? `${prefs.method === 'median' ? 'Median' : 'Average'} of ${soldPool.length} sold · ${rangeLabel}` : 'No sold prices in this range yet'}</p>
              </div>
              <div className="price-value">
                <strong>{money(soldPrice, prefs.currency)}</strong>
                {lastSold && <small>last sold {fmtDate(lastSold)}</small>}
              </div>
            </div>
            {(metrics.dealerPrice !== null || fees) && (
              <div className="price-foot">
                <Store size={16} />
                {metrics.dealerPrice !== null ? (
                  <span>Expect to pay <strong>{money(metrics.dealerPrice, prefs.currency)}</strong> when buying from a dealer</span>
                ) : fees ? (
                  <span>Selling on Chrono24 at this price, you would receive <strong>{money(fees.sellerNet, prefs.currency)}</strong> after the 6.95% fee</span>
                ) : null}
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
              {[['Global', 'Global'], ['EU', 'Europe'], ['US', 'America'], ['Asia', 'Asia'], ['FI', 'Finland']].map(([v, l]) => (
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
        </div>
      </section>

      <section className="live-strip">
          <p className="live-status" role="status">
            <span className={`live-dot ${liveState}`} />
            {liveState === 'loading'
              ? 'Checking marketplaces for live listings…'
              : liveState === 'error'
                ? liveError
                : (
                  <>
                    Checked {live?.sources.filter((s) => s.status === 'ok').map((s) => s.name).join(', ') || 'no sources'} · updated {live && ago(live.fetchedAt)}
                    {convertedCount > 0 && fx && <> · other currencies converted at ECB rates of {fx.date}</>}
                    {otherCurrency > 0 && (
                      <>
                        {' · '}
                        <button className="text-btn" onClick={() => onPrefs({ ...prefs, currency: topOther })}>
                          {otherCurrency} more in other currencies — show {topOther}
                        </button>
                      </>
                    )}
                  </>
                )}
            {liveState !== 'loading' && signedIn && (
              <button className="text-btn" onClick={() => loadLive(true)}>
                <RefreshCw size={13} />Refresh
              </button>
            )}
          </p>
          {live && (
            <div className="source-chips">
              {live.sources.map((src) => (
                <span key={src.id} className={`source-chip ${src.status}`} title={src.message}>
                  <span className="dot" />
                  {src.name}
                  <small>{src.status === 'ok' ? `${src.count} found` : src.status === 'blocked' ? 'blocked · manual' : src.status === 'credentials_required' ? 'not connected' : 'error'}</small>
                  {src.searchUrl && src.status !== 'ok' && (
                    <a href={src.searchUrl} target="_blank" rel="noreferrer">Search <ArrowUpRight size={12} /></a>
                  )}
                </span>
              ))}
              {groupSources.map((g) => {
                const href = facebookGroupSearchUrl(g.url || '', `${model.brand} ${baseReference(model.reference)}`);
                return href ? (
                  <span key={g.id} className="source-chip blocked" title="Facebook has no API for groups. Search the group, then save posts with the Save to WatchLedger button.">
                    <span className="dot" />
                    {g.name}
                    <small>save button</small>
                    <a href={href} target="_blank" rel="noreferrer">Search group <ArrowUpRight size={12} /></a>
                    <button className="chip-link" onClick={() => onNavigate({ view: 'import' })}>Import posts</button>
                  </span>
                ) : null;
              })}
            </div>
          )}

      </section>

      <section className="panel chart-card">
        <div className="chart-card-head">
          <div>
            <h2>Charts &amp; metrics</h2>
            <p>{model.brand} {baseReference(model.reference)} · {prefs.currency}{prefs.region !== 'Global' ? ` · ${regions.find(([r]) => r === prefs.region)?.[1]}` : ''}</p>
          </div>
          <div className="period-tabs" role="tablist" aria-label="Time range">
            {periods.map(([v, l]) => (
              <button key={v} role="tab" aria-selected={prefs.period === v} className={prefs.period === v ? 'active' : ''} onClick={() => onPrefs({ ...prefs, period: v })}>{l}</button>
            ))}
          </div>
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
              <FilterBar prefs={prefs} onPrefs={onPrefs} extended />
              {similarIn.length > 0 && <button className="text-btn" aria-pressed={showSimilar} onClick={() => setShowSimilar((v) => !v)}>{showSimilar ? 'Hide' : 'Show'} similar / unverified variants ({similarIn.length})</button>}
            </div>
            {chartPoints.length ? (
              <><PriceScatter points={chartPoints} currency={prefs.currency} period={prefs.period} marketPrice={marketPrice} /><p className="fine">Automatic prices require the complete reference {model.reference}, including any variant suffix. Similar and unverified variants are optional context and never affect the market price. Sold · last ask is an advertised price, not the negotiated sale amount.</p></>
            ) : (
              <div className="chart-empty">
                <div className="empty-chart-lines" />
                <h3>{liveState === 'loading' ? 'Loading prices…' : 'No prices for these filters yet'}</h3>
                <p>{liveState === 'loading' ? 'Checking live marketplaces.' : `Listings must confirm the complete reference ${model.reference}. You can view similar / unverified variants separately or record a verified price.`}</p>
              </div>
            )}
          </>
        )}
        {chartTab === 'volume' && <VolumeChart period={prefs.period} points={metricPrices.filter((p) => prefs.period === '36500' || p.date >= periodStart(prefs.period)).map((p) => ({ date: p.date, sold: p.status !== 'asking' }))} />}
        {chartTab === 'days' && <DaysChart ages={ages} />}
        <MetricsGrid m={metrics} hasRetail={Boolean(retail)} onRetail={() => { setRetailEdit(true); scrollTo({ top: 0, behavior: 'smooth' }); }} />
      </section>

      <RiskPanel m={metrics} reference={`${model.brand} ${baseReference(model.reference)}`} />

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Listings for this reference <span className="count-pill">{exactIn.length}</span></h2>
            <p>Automatically collected asking prices and reported sales, newest first. Listings are retained in your archive when a source stops returning them.</p>
          </div>
        </div>
        {liveState === 'loading' && !live ? (
          <div className="listing-grid">{Array.from({ length: 4 }, (_, i) => <div key={i} className="listing skeleton" />)}</div>
        ) : exactIn.length ? (
          <div className="listing-grid">{sortedExact.map((l) => <ListingCard key={l.url} l={l} />)}</div>
        ) : (
          <p className="muted-line">No exact-reference listings match these filters in {prefs.currency}{prefs.region !== 'Global' ? ` for ${regions.find(([r]) => r === prefs.region)?.[1]}` : ''}.</p>
        )}
        {(live?.threads?.length ?? 0) > 0 && (
          <div className="similar-block">
            <p className="thread-head">Also for sale, price not in the forum preview</p>
            <ul className="thread-list">
              {live!.threads!.map((t) => (
                <li key={t.url}>
                  <a href={t.url} target="_blank" rel="noreferrer">{t.title} <ArrowUpRight size={12} /></a>
                  <small>{t.source} · {fmtDate(t.date)}</small>
                </li>
              ))}
            </ul>
            <p className="fine">Open the thread and use the Save to WatchLedger button (select the price text first) to add its price.</p>
          </div>
        )}
        {similarIn.length > 0 && (
          <div className="similar-block">
            <button className="text-btn" aria-expanded={showSimilar} onClick={() => setShowSimilar((v) => !v)}>
              {showSimilar ? 'Hide' : 'Show'} {similarIn.length} similar / unverified listings <ChevronRight size={14} className={showSimilar ? 'rot' : ''} />
            </button>
            <p className="fine">These may have a different dial, bracelet or model reference, or omit the variant suffix. They are hidden from the graph by default and never used for the market price.</p>
            {showSimilar && <div className="listing-grid">{similarIn.map((l) => <ListingCard key={l.url} l={l} />)}</div>}
          </div>
        )}
      </section>

      <section className="panel fee-panel">
          <div className="fee-card">
            <div className="fee-head">
              <div>
                <h3>Chrono24 price after fees</h3>
                <p>Chrono24 keeps 6.95% of the sale. The listed price is what the buyer pays; the seller receives the rest.</p>
              </div>
              <label className="fee-input">
                <span>Listed price ({prefs.currency})</span>
                <input type="number" min="1" step="1" inputMode="numeric" placeholder={marketPrice ? String(Math.round(marketPrice)) : 'e.g. 9000'} value={sellInput} onChange={(e) => setSellInput(e.target.value)} />
              </label>
            </div>
            {fees ? (
              <dl className="fee-rows">
                <div><dt>Price with fees (buyer pays)</dt><dd>{money(fees.listed, prefs.currency)}</dd></div>
                <div><dt>Chrono24 commission 6.95%</dt><dd className="neg">−{money(fees.commission, prefs.currency)}</dd></div>
                <div className="total"><dt>Seller receives</dt><dd>{money(fees.sellerNet, prefs.currency)}</dd></div>
                <div className="hint"><dt>To receive {money(fees.listed, prefs.currency)}, list at</dt><dd>{money(fees.listToNet, prefs.currency)}</dd></div>
              </dl>
            ) : (
              <p className="fine">Enter a price, or wait for a market price, to see the breakdown.</p>
            )}
            <div className="fee-actions">
              {live?.sources.find((x) => x.id === 'chrono24')?.searchUrl && (
                <a className="secondary" href={live.sources.find((x) => x.id === 'chrono24')!.searchUrl} target="_blank" rel="noreferrer">
                  See this watch on Chrono24 <ArrowUpRight size={13} />
                </a>
              )}
              <button className="text-btn" onClick={() => onModal('observation')}>
                <Plus size={13} />Record a Chrono24 price
              </button>
            </div>
          </div>
      </section>

      <section className="detail-split">
        <div className="panel">
          <div className="section-head">
            <h2>By region</h2>
          </div>
          <div className="region-list">
            {regional.map(({ r, name, n, v }) => (
              <button key={r} className={prefs.region === r ? 'active' : ''} onClick={() => onPrefs({ ...prefs, region: prefs.region === r ? 'Global' : r })}>
                <span>
                  {name}
                  <small>{n} price{n === 1 ? '' : 's'}</small>
                </span>
                <strong>{money(v, prefs.currency)}</strong>
              </button>
            ))}
          </div>
          <p className="fine">Region follows seller location. Currencies are never converted.</p>
        </div>
        <div className="panel">
          <div className="section-head">
            <h2>Your price records <span className="count-pill">{savedAll.length}</span></h2>
            <button className="secondary" onClick={() => onModal('observation')}>
              <Plus size={14} />Record
            </button>
          </div>
          {savedAll.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Price</th><th>Type</th><th>Source</th><th>Date</th><th /></tr>
                </thead>
                <tbody>
                  {[...savedAll].sort((a, b) => b.data.observedAt.localeCompare(a.data.observedAt)).map((e) => (
                    <tr key={e.id}>
                      <td className="price-cell">
                        {money(e.data.price, e.data.currency)}
                        {feeBreakdown(e.data.price, e.data.sourceId) && <small>Seller gets {money(feeBreakdown(e.data.price, e.data.sourceId)!.sellerNet, e.data.currency)}</small>}
                      </td>
                      <td><span className="tag">{statuses[e.data.status]}</span></td>
                      <td>
                        {e.data.url ? (
                          <a href={e.data.url} target="_blank" rel="noreferrer">{sourceName(e.data.sourceId)} <ExternalLink size={11} /></a>
                        ) : sourceName(e.data.sourceId)}
                        <small>{countries[e.data.country]}</small>
                      </td>
                      <td>{e.data.observedAt}</td>
                      <td>
                        <button className="icon-btn" aria-label="Remove price record" onClick={() => onRemove(e.id)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-line">No saved prices yet. Bookmark a live listing above or record a sale you know about.</p>
          )}
        </div>
      </section>

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
    </div>
  );
}
