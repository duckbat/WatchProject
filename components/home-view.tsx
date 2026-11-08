'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Check, LineChart, Radar, Search, ShieldCheck } from 'lucide-react';
import { catalog, money, type Model } from '../lib/market';
import FilterBar from './filter-bar';
import SearchBox from './search-box';
import WatchPhoto from './watch-photo';
import { popularBrands, type BrandFacet, type Prefs, type Route } from './shared';

type CatalogPage = { items: Model[]; total: number; totalCatalog: number; pages: number; brands: string[] };
type Props = {
  route: Route;
  brands: BrandFacet[];
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onNavigate: (r: Route) => void;
  priceFor: (id: string) => { value: number | null; count: number };
  ownedIds: Set<string>;
  recent: Model[];
  ownedModels: Model[];
  onModels: (ms: Model[]) => void;
};

export function WatchCard({ model, price, owned, onOpen }: { model: Model; price?: { value: number | null; count: number; currency: string }; owned?: boolean; onOpen: () => void }) {
  return (
    <button className="watch-tile" onClick={onOpen}>
      <div className="watch-tile-photo">
        <WatchPhoto key={model.imageUrl || model.id} model={model} />
        {owned && (
          <span className="owned-tag">
            <Check size={11} />Owned
          </span>
        )}
      </div>
      <div className="watch-tile-info">
        <span className="watch-tile-brand">{model.brand}</span>
        <h3>{model.name}</h3>
        <p>Ref. {model.reference}</p>
        {model.variants && model.variants > 1 ? <span className="variant-count">{model.variants} variants</span> : null}
        <div className="watch-tile-price">
          {model.market ? (
            <>
              <strong>{money(model.market.price, model.market.currency)}</strong>
              <small>{model.market.count} market price{model.market.count === 1 ? '' : 's'}</small>
            </>
          ) : price && price.value !== null ? (
            <>
              <strong>{money(price.value, price.currency)}</strong>
              <small>{price.count} saved prices</small>
            </>
          ) : (
            <>
              <span className="see-price">
                See market price <ArrowRight size={13} />
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

export default function HomeView({ route, brands, prefs, onPrefs, onNavigate, priceFor, ownedIds, recent, ownedModels, onModels }: Props) {
  const q = route.q || '';
  const brand = route.brand || '';
  const searching = Boolean(q || brand);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CatalogPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tracked, setTracked] = useState<Model[]>([]);
  const totalCatalog = brands.reduce((n, b) => n + b.count, 0);

  useEffect(() => setPage(1), [q, brand]);
  // The watches with the most market prices found so far; the starter list shows until data exists.
  useEffect(() => {
    if (searching) return;
    const controller = new AbortController();
    fetch(`/api/catalog?${new URLSearchParams({ popular: '1', limit: '12', currency: prefs.currency })}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ items?: Model[] }>) : null))
      .then((d) => {
        if (!d?.items?.length) return;
        setTracked(d.items);
        onModels(d.items);
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, prefs.currency]);
  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`/api/catalog?${new URLSearchParams({ q, brand, page: String(page), currency: prefs.currency })}`, { signal: controller.signal })
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
        onModels(d.items);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError('Could not load watches. Please retry.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, brand, page, searching, prefs.currency]);

  const open = (m: Model) => onNavigate({ view: 'watch', id: m.id });
  const brandNames = brands.map((b) => b.brand);
  const featuredBrands = popularBrands.map((b) => brands.find((x) => x.brand === b)).filter(Boolean) as BrandFacet[];
  const withCurrency = (id: string) => ({ ...priceFor(id), currency: prefs.currency });

  return (
    <div className={`home${searching ? ' searching' : ''}`}>
      <section className="hero">
        {!searching && (
          <>
            <p className="eyebrow">WATCH PRICE SEARCH</p>
            <h1>What is a watch worth today?</h1>
            <p className="hero-sub">
              Search {totalCatalog ? totalCatalog.toLocaleString('en') : '40,000+'} references across {brands.length || 224} brands. See live marketplace asking prices and your own price history in one place.
            </p>
          </>
        )}
        <SearchBox
          variant="hero"
          initial={q}
          brands={brands}
          currency={prefs.currency}
          totalCatalog={totalCatalog}
          autoFocus={!searching}
          onSubmit={(next) => onNavigate({ view: 'home', q: next, brand })}
          onPickBrand={(b) => onNavigate({ view: 'home', brand: b })}
          onPickWatch={open}
        />
        <FilterBar prefs={prefs} onPrefs={onPrefs} brand={brand} brands={brandNames} onBrand={(b) => onNavigate({ view: 'home', q, brand: b })} />
      </section>

      {searching ? (
        <section className="results" aria-label="Search results">
          <div className="results-head">
            <p aria-live="polite">
              {loading ? 'Searching…' : data ? (
                <>
                  <strong>{data.total.toLocaleString('en')}</strong> {data.total === 1 ? 'watch' : 'watches'}
                  {q && <> for “{q}”</>}
                  {brand && <> in {brand}</>}
                </>
              ) : null}
            </p>
            {data && data.pages > 1 && (
              <div className="pager">
                <button className="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>{page} / {data.pages.toLocaleString('en')}</span>
                <button className="secondary" disabled={page >= data.pages || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </div>
          {error ? (
            <p className="notice error" role="alert">{error}</p>
          ) : loading && !data ? (
            <div className="tile-grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="watch-tile skeleton" />)}</div>
          ) : data && data.items.length ? (
            <div className={`tile-grid${loading ? ' dim' : ''}`}>
              {data.items.map((m) => (
                <WatchCard key={m.id} model={m} price={withCurrency(m.id)} owned={ownedIds.has(m.id)} onOpen={() => open(m)} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <Search />
              <h3>No watches found</h3>
              <p>Try a reference number (like 126610LN), a model line, or another brand.</p>
            </div>
          )}
        </section>
      ) : (
        <>
          {recent.length > 0 && (
            <section className="home-section">
              <div className="home-section-head">
                <h2>Recently viewed</h2>
              </div>
              <div className="tile-row">
                {recent.slice(0, 6).map((m) => (
                  <WatchCard key={m.id} model={m} price={withCurrency(m.id)} owned={ownedIds.has(m.id)} onOpen={() => open(m)} />
                ))}
              </div>
            </section>
          )}

          <section className="home-section">
            <div className="home-section-head">
              <h2>Popular brands</h2>
              <button className="text-btn" onClick={() => onNavigate({ view: 'brands' })}>
                All {brands.length || ''} brands <ArrowRight size={14} />
              </button>
            </div>
            <div className="brand-chips">
              {featuredBrands.map((b) => (
                <button key={b.brand} className="brand-chip" onClick={() => onNavigate({ view: 'home', brand: b.brand })}>
                  <span className="brand-mono">{b.brand.charAt(0)}</span>
                  <span>
                    {b.brand}
                    <small>{b.count.toLocaleString('en')} references</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="home-section">
            <div className="home-section-head">
              <h2>{tracked.length ? 'Most tracked watches' : 'Popular references'}</h2>
              <p>{tracked.length ? 'Watches with the most market prices found' : 'Frequently searched watches'}</p>
            </div>
            <div className="tile-grid">
              {(tracked.length ? tracked : catalog).map((m) => (
                <WatchCard key={m.id} model={m} price={withCurrency(m.id)} owned={ownedIds.has(m.id)} onOpen={() => open(m)} />
              ))}
            </div>
          </section>

          {ownedModels.length > 0 && (
            <section className="home-section">
              <div className="home-section-head">
                <h2>My watches</h2>
                <button className="text-btn" onClick={() => onNavigate({ view: 'collection' })}>
                  Open collection <ArrowRight size={14} />
                </button>
              </div>
              <div className="tile-row">
                {ownedModels.slice(0, 6).map((m) => (
                  <WatchCard key={m.id} model={m} price={withCurrency(m.id)} owned onOpen={() => open(m)} />
                ))}
              </div>
            </section>
          )}

          <section className="how-it-works">
            <article>
              <Search size={20} />
              <h3>Search any reference</h3>
              <p>Find a watch by model, family, or exact reference. Suggestions appear as you type.</p>
            </article>
            <article>
              <Radar size={20} />
              <h3>See live asking prices</h3>
              <p>Each watch page checks marketplaces for current listings and links straight to them.</p>
            </article>
            <article>
              <LineChart size={20} />
              <h3>Build your price history</h3>
              <p>Save listings and sales you trust. Charts show only prices that were actually observed.</p>
            </article>
            <article>
              <ShieldCheck size={20} />
              <h3>Private by default</h3>
              <p>Your watches and price records are stored in your own workspace and can be exported.</p>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
