'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Bookmark, BookmarkCheck, ChevronRight, ExternalLink, Plus, RefreshCw, Trash2, Watch } from 'lucide-react';
import { countries, facebookGroupSearchUrl, feeBreakdown, inRegion, latestListings, money, summarize, type Entry, type Model, type Observation } from '../lib/market';
import FilterBar from './filter-bar';
import { baseReference } from '../lib/collectors';
import PriceScatter, { type ChartPoint } from './price-scatter';
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
};

function ago(iso: string) {
  const m = Math.round((Date.now() - +new Date(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

export default function WatchDetail({ modelId, model, entries, sourceName, prefs, onPrefs, onNavigate, onModal, onSaveListing, onRemove, onModels, signedIn, groupSources = [] }: Props) {
  const [live, setLive] = useState<LiveResult | null>(null);
  const [liveState, setLiveState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [liveError, setLiveError] = useState('');
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState('');
  const [showSimilar, setShowSimilar] = useState(false);
  const [related, setRelated] = useState<Model[]>([]);
  const [sellInput, setSellInput] = useState('');

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
  const saved = entries.filter((e) => e.kind === 'observation' && e.data.modelId === modelId) as (Entry & { data: Observation })[];
  const savedShown = saved.filter((e) => matchesPrefs(e.data, prefs));
  const savedPrice = summarize(latestListings(savedShown).map((e) => e.data.price), prefs.method);
  const listings = live?.listings || [];
  const liveIn = (l: LiveListing) => l.currency === prefs.currency && inRegion(l.country, prefs.region) && (prefs.condition === 'all' || l.condition === prefs.condition) && (prefs.seller === 'all' || l.sellerType === prefs.seller) && (prefs.basis === 'all' || l.status === prefs.basis) && l.observedAt >= periodStart(prefs.period);
  const exact = listings.filter((l) => l.match === 'exact');
  const similar = listings.filter((l) => l.match === 'similar');
  const exactIn = exact.filter(liveIn);
  const similarIn = similar.filter(liveIn);
  const livePrice = summarize(exactIn.map((l) => l.price), prefs.method);
  const similarPrice = summarize(similarIn.map((l) => l.price), prefs.method);
  const marketPrice = livePrice ?? savedPrice;
  const marketBasis = livePrice !== null ? `${prefs.method === 'median' ? 'Median' : 'Average'} of ${exactIn.length} exact-reference listing${exactIn.length === 1 ? '' : 's'} · ${periods.find(([v]) => v === prefs.period)?.[1]}` : savedPrice !== null ? `From ${latestListings(savedShown).length} of your saved prices` : '';
  const lows = exactIn.map((l) => l.price);
  const otherCurrencies = exact.filter((l) => l.currency !== prefs.currency).map((l) => l.currency);
  const otherCurrency = otherCurrencies.length;
  const topOther = otherCurrencies.sort((a, b) => otherCurrencies.filter((x) => x === b).length - otherCurrencies.filter((x) => x === a).length)[0];
  const sellPrice = Number(sellInput) > 0 ? Number(sellInput) : marketPrice;
  const fees = sellPrice ? feeBreakdown(sellPrice, 'chrono24') : null;
  const sortedExact = [...exactIn].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const savedToday = new Set(saved.filter((e) => e.data.observedAt === today()).map((e) => e.data.url));
  const owned = entries.filter((e) => e.kind === 'owned' && e.data.modelId === modelId);

  const points: ChartPoint[] = [
    ...savedShown.filter((e) => !(e.data.observedAt === today() && exactIn.some((l) => l.url === e.data.url))).map((e) => ({ id: e.id, date: e.data.observedAt, price: e.data.price, kind: e.data.status as ChartPoint['kind'], title: (e.data as any).title || `${model.brand} ${model.reference}`, url: e.data.url || undefined, source: sourceName(e.data.sourceId), country: countries[e.data.country] || e.data.country })),
    ...[...exactIn.map((l) => ({ l, kind: l.status === 'sold-asking' ? ('sold-asking' as const) : ('live' as const) })), ...similarIn.map((l) => ({ l, kind: 'similar' as const }))].map(({ l, kind }) => ({ id: `live-${l.url}`, date: l.observedAt, price: l.price, kind, title: l.title, url: l.url, source: sourceName(l.sourceId), country: countries[l.country] || l.country })),
  ];

  const regional = regions.filter(([r]) => r !== 'Global').map(([r, name]) => {
    const pool = [
      ...latestListings(saved.filter((e) => matchesPrefs(e.data, prefs, { region: false }) && inRegion(e.data.country, r))).map((e) => e.data.price),
      ...exact.filter((l) => l.currency === prefs.currency && inRegion(l.country, r) && !savedToday.has(l.url)).map((l) => l.price),
    ];
    return { r, name, n: pool.length, v: summarize(pool, prefs.method) };
  });

  async function save(l: LiveListing) {
    setSaving(l.url);
    try {
      await onSaveListing(l);
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
          <strong className="listing-price">{money(l.price, l.currency)}{l.status === 'sold-asking' && <span className="tag sold-tag">Sold</span>}</strong>
          {l.sourceId !== 'tori' && l.observedAt !== today() && <span className="listing-source">Posted {l.observedAt}</span>}
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

      <section className="detail-top">
        <div className="detail-photo">
          <WatchPhoto key={model.imageUrl || model.id} model={model} iconSize={70} />
          {owned.length > 0 && <span className="owned-tag">In my watches</span>}
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
              <button className="secondary" onClick={() => onModal('observation')}>
                <Plus size={15} />Record a price
              </button>
              <button className="primary" onClick={() => onModal('owned')}>
                <Plus size={15} />Add to my watches
              </button>
            </div>
          </div>

          <div className="price-cards">
            <article className="price-card main">
              <p>Market price</p>
              {liveState === 'loading' && marketPrice === null ? (
                <span className="price-loading">Checking marketplaces…</span>
              ) : (
                <strong>{money(marketPrice, prefs.currency)}</strong>
              )}
              <small>
                {marketPrice !== null
                  ? marketBasis
                  : liveState === 'loading'
                    ? 'Looking for exact-reference listings'
                    : similarPrice !== null
                      ? `No exact listing live now · similar models ${money(similarPrice, prefs.currency)}`
                      : 'No exact-reference listings found right now'}
              </small>
            </article>
            <article className="price-card">
              <p>Listing price range</p>
              <strong>{lows.length ? (lows.length === 1 ? money(lows[0], prefs.currency) : `${money(Math.min(...lows), prefs.currency)} – ${money(Math.max(...lows), prefs.currency)}`) : '—'}</strong>
              <small>{exactIn.length} exact listing{exactIn.length === 1 ? '' : 's'}{similarIn.length ? ` · ${similarIn.length} similar` : ''}</small>
            </article>
            <article className="price-card">
              <p>Your saved prices</p>
              <strong>{money(savedPrice, prefs.currency)}</strong>
              <small>{savedShown.length} observation{savedShown.length === 1 ? '' : 's'} · {periods.find(([v]) => v === prefs.period)?.[1]}</small>
            </article>
            {owned.length > 0 && (
              <article className="price-card">
                <p>You paid</p>
                <strong>{money(owned[0].data.cost, owned[0].data.currency)}</strong>
                <small>
                  {marketPrice !== null && owned[0].data.currency === prefs.currency
                    ? `${marketPrice - owned[0].data.cost >= 0 ? '+' : ''}${money(marketPrice - owned[0].data.cost, prefs.currency)} vs market`
                    : `Bought ${owned[0].data.purchaseDate}`}
                </small>
              </article>
            )}
          </div>

          <p className="live-status" role="status">
            <span className={`live-dot ${liveState}`} />
            {liveState === 'loading'
              ? 'Checking marketplaces for live listings…'
              : liveState === 'error'
                ? liveError
                : (
                  <>
                    Live from {live?.sources.filter((s) => s.status === 'ok').map((s) => s.name).join(', ') || 'no sources'} · updated {live && ago(live.fetchedAt)}
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
                  </span>
                ) : null;
              })}
            </div>
          )}

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
        </div>
      </section>

      <section className="panel chart-card">
        <div className="chart-card-head">
          <div>
            <h2>Prices &amp; listings</h2>
            <p>Each dot is a listing or a price you saved. Click one to go to the listing.</p>
          </div>
          <div className="period-tabs" role="tablist" aria-label="Time range">
            {periods.map(([v, l]) => (
              <button key={v} role="tab" aria-selected={prefs.period === v} className={prefs.period === v ? 'active' : ''} onClick={() => onPrefs({ ...prefs, period: v })}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <FilterBar prefs={prefs} onPrefs={onPrefs} extended />
        {points.length ? (
          <PriceScatter points={points} currency={prefs.currency} period={prefs.period} marketPrice={livePrice ?? null} />
        ) : (
          <div className="chart-empty">
            <div className="empty-chart-lines" />
            <h3>{liveState === 'loading' ? 'Loading prices…' : 'No prices for these filters yet'}</h3>
            <p>{liveState === 'loading' ? 'Checking live marketplaces.' : 'Try another currency or region, or record a price you have seen.'}</p>
            {liveState !== 'loading' && (
              <button className="secondary" onClick={() => onModal('observation')}>
                <Plus size={15} />Record a price
              </button>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Listings for this reference <span className="count-pill">{exactIn.length}</span></h2>
            <p>Listings that name this exact reference, newest first (Tori.fi live, plus r/Watchexchange and eBay when connected). Bookmark one to add it to your price history.</p>
          </div>
        </div>
        {liveState === 'loading' && !live ? (
          <div className="listing-grid">{Array.from({ length: 4 }, (_, i) => <div key={i} className="listing skeleton" />)}</div>
        ) : exactIn.length ? (
          <div className="listing-grid">{sortedExact.map((l) => <ListingCard key={l.url} l={l} />)}</div>
        ) : (
          <p className="muted-line">No exact-reference listings are live in {prefs.currency}{prefs.region !== 'Global' ? ` for ${regions.find(([r]) => r === prefs.region)?.[1]}` : ''} right now.</p>
        )}
        {similarIn.length > 0 && (
          <div className="similar-block">
            <button className="text-btn" aria-expanded={showSimilar} onClick={() => setShowSimilar((v) => !v)}>
              {showSimilar ? 'Hide' : 'Show'} {similarIn.length} similar listings <ChevronRight size={14} className={showSimilar ? 'rot' : ''} />
            </button>
            <p className="fine">Same model line, but the title does not confirm this reference. They are not used for the market price.</p>
            {showSimilar && <div className="listing-grid">{similarIn.map((l) => <ListingCard key={l.url} l={l} />)}</div>}
          </div>
        )}
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
            <h2>Your price records <span className="count-pill">{saved.length}</span></h2>
            <button className="secondary" onClick={() => onModal('observation')}>
              <Plus size={14} />Record
            </button>
          </div>
          {saved.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Price</th><th>Type</th><th>Source</th><th>Date</th><th /></tr>
                </thead>
                <tbody>
                  {[...saved].sort((a, b) => b.data.observedAt.localeCompare(a.data.observedAt)).map((e) => (
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
