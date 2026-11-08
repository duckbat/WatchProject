'use client';
import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Database, Download, Layers3, Plus, Search, Trash2, Watch } from 'lucide-react';
import { countries, latestListings, money, summarize, type Entry, type Model, type Observation } from '../lib/market';
import FilterBar from './filter-bar';
import { WatchCard } from './home-view';
import { BookmarkletInstall } from './save-from-web';
import { matchesPrefs, statuses, type BrandFacet, type ModalKind, type Prefs, type Route } from './shared';

type Source = { id: string; name: string; url?: string; country?: string; mode?: string };

export function CollectionView({ entries, models, prefs, onPrefs, onNavigate, onModal, onRemove }: { entries: Entry[]; models: Record<string, Model>; prefs: Prefs; onPrefs: (p: Prefs) => void; onNavigate: (r: Route) => void; onModal: (k: ModalKind) => void; onRemove: (id: string) => void }) {
  const owned = entries.filter((e) => e.kind === 'owned');
  const obs = entries.filter((e) => e.kind === 'observation') as (Entry & { data: Observation })[];
  const value = (id: string) => summarize(latestListings(obs.filter((e) => e.data.modelId === id && matchesPrefs(e.data, prefs))).map((e) => e.data.price), prefs.method);
  const priced = owned.filter((e) => value(e.data.modelId) !== null);
  const total = priced.length ? priced.reduce((n, e) => n + value(e.data.modelId)!, 0) : null;
  const paid = owned.filter((e) => e.data.currency === prefs.currency).reduce((n, e) => n + e.data.cost, 0);
  return (
    <div className="account">
      <div className="account-head">
        <div>
          <p className="eyebrow">PROFILE</p>
          <h1>My watches</h1>
          <p className="subtitle">Your collection compared with the prices you have saved.</p>
        </div>
        <button className="primary" onClick={() => onModal('owned')}><Plus size={16} />Add a watch I own</button>
      </div>
      <FilterBar prefs={prefs} onPrefs={onPrefs} />
      <section className="stats">
        <article><p>COLLECTION VALUE <Layers3 size={15} /></p><strong>{money(total, prefs.currency)}</strong><small>{priced.length} of {owned.length} watches have saved prices</small></article>
        <article><p>TOTAL PAID <Watch size={15} /></p><strong>{money(owned.length ? paid : null, prefs.currency)}</strong><small>Purchases recorded in {prefs.currency}</small></article>
        <article><p>WATCHES <Database size={15} /></p><strong>{String(owned.length).padStart(2, '0')}</strong><small>A private record of what you own</small></article>
      </section>
      {owned.length ? (
        <>
          <div className="tile-grid">
            {[...new Set(owned.map((e) => e.data.modelId as string))].map((id) => models[id] && (
              <WatchCard key={id} model={models[id]} price={{ value: value(id), count: obs.filter((e) => e.data.modelId === id).length, currency: prefs.currency }} owned onOpen={() => onNavigate({ view: 'watch', id })} />
            ))}
          </div>
          <section className="panel">
            <div className="section-head"><h2>Purchase records</h2></div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Watch</th><th>Purchase date</th><th>Paid</th><th>Saved median</th><th>Difference</th><th /></tr></thead>
                <tbody>
                  {owned.map((e) => {
                    const m = models[e.data.modelId];
                    const v = value(e.data.modelId);
                    const same = e.data.currency === prefs.currency;
                    return (
                      <tr key={e.id}>
                        <td><button className="table-model" onClick={() => onNavigate({ view: 'watch', id: e.data.modelId })}>{m ? `${m.brand} ${m.name}` : 'Loading…'}</button><small>{m?.reference}</small></td>
                        <td>{e.data.purchaseDate}</td>
                        <td>{money(e.data.cost, e.data.currency)}</td>
                        <td>{money(v, prefs.currency)}</td>
                        <td>{v !== null && same ? money(v - e.data.cost, prefs.currency) : '—'}<small>{!same ? 'Different currencies' : 'Based on filters'}</small></td>
                        <td><button className="icon-btn" aria-label="Remove owned watch" onClick={() => onRemove(e.id)}><Trash2 size={15} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div className="empty">
          <Watch />
          <h3>Your collection starts here</h3>
          <p>Find your watch, then add it with the price you paid.</p>
          <button className="secondary" onClick={() => onNavigate({ view: 'home' })}><Search size={15} />Search watches</button>
        </div>
      )}
    </div>
  );
}

export function RecordsView({ entries, models, sources, prefs, onPrefs, onNavigate, onModal, onRemove, onExport }: { entries: Entry[]; models: Record<string, Model>; sources: Source[]; prefs: Prefs; onPrefs: (p: Prefs) => void; onNavigate: (r: Route) => void; onModal: (k: ModalKind) => void; onRemove: (id: string) => void; onExport: () => void }) {
  const obs = entries.filter((e) => e.kind === 'observation') as (Entry & { data: Observation & { title?: string } })[];
  const shown = obs.filter((e) => matchesPrefs(e.data, prefs));
  const name = (id: string) => sources.find((s) => s.id === id)?.name || id;
  return (
    <div className="account">
      <div className="account-head">
        <div>
          <p className="eyebrow">PROFILE</p>
          <h1>Price records</h1>
          <p className="subtitle">Every price you have saved, across all watches.</p>
        </div>
        <div className="row-actions">
          <button className="secondary" onClick={onExport}><Download size={15} />Export</button>
          <button className="primary" onClick={() => onModal('observation')}><Plus size={16} />Record a price</button>
        </div>
      </div>
      <FilterBar prefs={prefs} onPrefs={onPrefs} extended />
      <section className="panel">
        {shown.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Watch / reference</th><th>Source</th><th>Country</th><th>Price</th><th>Type</th><th>Observed</th><th /></tr></thead>
              <tbody>
                {[...shown].sort((a, b) => b.data.observedAt.localeCompare(a.data.observedAt)).map((e) => {
                  const o = e.data, m = models[o.modelId];
                  return (
                    <tr key={e.id}>
                      <td><button className="table-model" onClick={() => onNavigate({ view: 'watch', id: o.modelId })}>{m ? `${m.brand} ${m.name}` : o.title || o.modelId}</button><small>{m?.reference} · {o.condition} · {o.contents === 'full-set' ? 'Box & papers' : o.contents === 'watch-only' ? 'Watch only' : 'Contents unknown'}</small></td>
                      <td>{o.url ? <a href={o.url} target="_blank" rel="noreferrer">{name(o.sourceId)} <ArrowUpRight size={12} /></a> : name(o.sourceId)}</td>
                      <td>{countries[o.country]}</td>
                      <td className="price-cell">{money(o.price, o.currency)}{o.sourceId === 'chrono24' && <small>Seller gets {money(o.price * (1 - 0.0695), o.currency)}</small>}</td>
                      <td><span className="tag">{statuses[o.status]}</span></td>
                      <td>{o.observedAt}</td>
                      <td><button className="icon-btn" aria-label="Remove observation" onClick={() => onRemove(e.id)}><Trash2 size={15} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty compact">
            <Database size={25} />
            <h3>{obs.length ? 'No matching prices' : 'No saved prices yet'}</h3>
            <p>{obs.length ? 'Try another region, currency, price type, or time range.' : 'Open a watch and bookmark a live listing, or record a price you have seen.'}</p>
            <button className="text-btn" onClick={() => onNavigate({ view: 'home' })}>Search watches <ArrowRight size={15} /></button>
          </div>
        )}
      </section>
    </div>
  );
}

export function SourcesView({ sources, onModal, onImport }: { sources: Source[]; onModal: (k: ModalKind) => void; onImport: () => void }) {
  return (
    <div className="account">
      <div className="account-head">
        <div>
          <p className="eyebrow">PROFILE</p>
          <h1>Marketplace sources</h1>
          <p className="subtitle">Kellotux and Nordic marketplaces supply used-market asking prices. Laatukellot and Keskisen Kello add current shop prices, with new watches shown separately from the used market and official MSRP. Huuto.net, Auctionet, Antiquorum, Christie’s and Phillips add public sold evidence when available; sold-marked last asking prices stay separate from reported sale amounts. Listings are archived automatically and each watch shows collection failures. Estimates, open bids and unavailable shop products are never counted as sales.</p>
        </div>
        <button className="primary" onClick={() => onModal('source')}><Plus size={16} />Add source</button>
      </div>
      <section className="source-grid">
        {sources.map((s) => (
          <article className="source-card" key={s.id}>
            <div className="source-top">
              <span className="source-monogram">{s.name.slice(0, 1)}</span>
              <span className="tag">{s.id === 'reddit' ? 'API access required' : s.id === 'ebay' ? 'API keys needed' : s.id === 'chrono24' ? 'Save button · 6.95% fee shown' : s.id === 'watchuseek' ? 'Automatic public RSS' : s.mode || 'Manual observations'}</span>
            </div>
            <h2>{s.name}</h2>
            <p>{s.country ? countries[s.country] : 'Multiple regions'}</p>
            <div className="source-actions">{s.url && <a href={s.url} target="_blank" rel="noreferrer">Visit source <ArrowUpRight size={14} /></a>}</div>
          </article>
        ))}
        <button className="source-add" onClick={() => onModal('source')}><Plus size={26} /><strong>Add a local source</strong></button>
      </section>
      <section className="panel clip-panel" style={{ marginTop: 24 }}>
        <h2>Save prices from any website</h2>
        <p className="subtitle">Many posts at once? Use <button className="text-btn" onClick={() => onImport()}>Import group posts</button> to paste a whole Facebook group feed.</p>
        <p className="subtitle">For Chrono24, Facebook groups and other sites that can’t be searched automatically.</p>
        <BookmarkletInstall />
      </section>
    </div>
  );
}

export function BrandsView({ brands, onNavigate }: { brands: BrandFacet[]; onNavigate: (r: Route) => void }) {
  const [filter, setFilter] = useState('');
  const shown = brands.filter((b) => b.brand.toLowerCase().includes(filter.trim().toLowerCase()));
  const groups = new Map<string, BrandFacet[]>();
  for (const b of shown) {
    const k = /[a-z]/i.test(b.brand.normalize('NFD').charAt(0)) ? b.brand.normalize('NFD').charAt(0).toUpperCase() : '#';
    groups.set(k, [...(groups.get(k) || []), b]);
  }
  return (
    <div className="account">
      <div className="account-head">
        <div>
          <p className="eyebrow">CATALOG</p>
          <h1>All brands</h1>
          <p className="subtitle">{brands.length} brands · {brands.reduce((n, b) => n + b.count, 0).toLocaleString('en')} references</p>
        </div>
        <label className="search-inline">
          <Search size={15} />
          <input placeholder="Filter brands" aria-label="Filter brands" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
      </div>
      <div className="brand-index">
        {[...groups].map(([letter, list]) => (
          <section key={letter}>
            <h2>{letter}</h2>
            <div>
              {list.map((b) => (
                <button key={b.brand} onClick={() => onNavigate({ view: 'home', brand: b.brand })}>
                  {b.brand}
                  <small>{b.count.toLocaleString('en')}</small>
                </button>
              ))}
            </div>
          </section>
        ))}
        {!shown.length && <p className="muted-line">No brand matches “{filter}”.</p>}
      </div>
    </div>
  );
}
