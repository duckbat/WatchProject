'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, Check, MousePointerClick, Search } from 'lucide-react';
import { countries, currencies, facebookGroupId, feeBreakdown, isBrandSite, money, type Model } from '../lib/market';
import { extractPrice } from '../lib/collectors';
import SearchBox from './search-box';
import WatchPhoto from './watch-photo';
import { statuses, today, type BrandFacet, type Route } from './shared';

type Clip = { url: string; title: string; price?: string | number | null; currency?: string | null; image?: string | null; text?: string; site?: string };
type Source = { id: string; name: string; country?: string; url?: string };

/**
 * Runs on the listing page the user is viewing. It reads only that page (structured data, meta tags,
 * the user's text selection) and opens WatchLedger with the result in the URL fragment, which is never
 * sent to any server.
 */
function bookmarkletSource(origin: string) {
  return `(()=>{const q=s=>document.querySelector(s),m=n=>q('meta[property="'+n+'"],meta[name="'+n+'"],meta[itemprop="'+n+'"]')?.content;let price=null,currency=null,title=m('og:title')||q('h1')?.innerText||document.title;
const walk=o=>{if(!o||typeof o!=='object')return;if(Array.isArray(o))return o.forEach(walk);const off=o.offers;if(off&&price==null){const x=Array.isArray(off)?off[0]:off;const p=x&&(x.price??x.lowPrice);if(p!=null){price=p;currency=x.priceCurrency;if(o.name)title=o.name}}for(const v of Object.values(o))if(v&&typeof v==='object')walk(v)};
for(const s of document.querySelectorAll('script[type="application/ld+json"]')){try{walk(JSON.parse(s.textContent))}catch(e){}}
price=price??m('product:price:amount')??m('og:price:amount')??m('price');currency=currency||m('product:price:currency')||m('og:price:currency')||m('priceCurrency');
const sel=String(getSelection()||'').trim();const d={url:location.href.split('#')[0],title:String(title||'').trim().slice(0,300),price,currency,image:m('og:image')||null,text:(sel||m('og:description')||'').slice(0,1500),site:location.hostname};
window.open(${JSON.stringify(origin)}+'/?view=clip#'+encodeURIComponent(JSON.stringify(d)),'_blank')})()`;
}

export function BookmarkletInstall() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // React blocks javascript: URLs in JSX, so the bookmark link is set directly on the element.
    ref.current?.setAttribute('href', 'javascript:' + encodeURIComponent(bookmarkletSource(location.origin)));
  }, []);
  return (
    <div className="bookmarklet">
      <a ref={ref} className="bookmarklet-link" onClick={(e) => e.preventDefault()} draggable title="Drag me to your bookmarks bar">
        <Bookmark size={15} />Save to WatchLedger
      </a>
      <ol>
        <li>Drag the green button to your browser’s bookmarks bar (show it with ⌘⇧B / Ctrl+Shift+B).</li>
        <li>Open a listing on Chrono24, a Facebook group post, Reddit, eBay or any shop.</li>
        <li>On Facebook, open the post itself (click its date) and <strong>select the post text</strong> first, since Facebook pages have no structured price.</li>
        <li>Click the bookmark. WatchLedger opens with the price, link and title filled in; pick the watch and save.</li>
      </ol>
      <p className="fine">The button only reads the page you are looking at, in your own browser. Nothing is fetched from those sites by WatchLedger.</p>
    </div>
  );
}

function guessSource(site = '', url = '', sources: Source[] = []) {
  const group = facebookGroupId(url);
  const saved = group && sources.find((s) => facebookGroupId(s.url) === group);
  if (saved) return saved.id;
  const h = (site || (() => { try { return new URL(url).hostname; } catch { return ''; } })()).toLowerCase();
  if (h.includes('chrono24')) return 'chrono24';
  if (h.includes('facebook') || h.includes('fb.com')) return 'facebook';
  if (h.includes('reddit')) return 'reddit';
  if (h.includes('ebay')) return 'ebay';
  if (h.includes('tori.fi')) return 'tori';
  return 'web';
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function ClipView({ brands, sources, onSave, onNavigate }: { brands: BrandFacet[]; sources: Source[]; onSave: (kind: string, data: Record<string, unknown>) => Promise<void>; onNavigate: (r: Route) => void }) {
  const [clip, setClip] = useState<Clip | null>(null);
  const [candidates, setCandidates] = useState<Model[]>([]);
  const [model, setModel] = useState<Model | null>(null);
  const [finding, setFinding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<'observation' | 'retail'>('observation');
  const [form, setForm] = useState({ sourceId: 'web', price: '', currency: 'EUR', country: 'UNKNOWN', status: 'asking', condition: 'used', sellerType: 'private', contents: 'unknown', observedAt: today(), url: '', title: '' });

  useEffect(() => {
    try {
      const raw = decodeURIComponent(location.hash.slice(1));
      if (!raw) return;
      const d = JSON.parse(raw) as Clip;
      if (typeof d?.url !== 'string') return;
      setClip(d);
      const text = `${d.title || ''}\n${d.text || ''}`;
      const structured = Number(String(d.price ?? '').replace(/[^\d.]/g, ''));
      const guess = structured > 0 ? { price: structured, currency: String(d.currency || '').toUpperCase() } : extractPrice(text);
      const sourceId = guessSource(d.site, d.url, sources);
      if (isBrandSite(d.site || '')) setKind('retail');
      setForm((f) => ({
        ...f,
        sourceId,
        url: d.url,
        title: (d.title || '').slice(0, 300),
        price: guess ? String(guess.price) : '',
        currency: guess && (currencies as readonly string[]).includes(guess.currency) ? guess.currency : f.currency,
        country: sourceId === 'tori' ? 'FI' : 'UNKNOWN',
        sellerType: sourceId === 'chrono24' ? 'dealer' : 'private',
      }));
    } catch {
      setError('Could not read the saved page. Try the button again.');
    }
  }, []);

  // Look up catalog references mentioned in the listing (e.g. "126200", "SPB143").
  useEffect(() => {
    if (!clip) return;
    const words = `${clip.title} ${clip.text || ''}`.match(/[A-Za-z0-9][A-Za-z0-9.\-/]{3,}/g) || [];
    const tokens = [...new Set(words.filter((w) => /\d/.test(w) && !/^(19|20)\d\d$/.test(w) && !/^\d{1,3}([.,]\d{3})+$/.test(w) && w.length <= 24).map((w) => w.replace(/^m(?=\d{5})/i, '')))].slice(0, 6); // Rolex/Tudor write M126200-0001
    if (!tokens.length) return;
    setFinding(true);
    Promise.all(tokens.map((t) => fetch(`/api/catalog?${new URLSearchParams({ q: t, limit: '4' })}`).then((r) => r.json()).then((d: any) => ({ t, items: (d.items || []) as Model[] })).catch(() => ({ t, items: [] as Model[] }))))
      .then((groups) => {
        const seen = new Set<string>();
        const ranked = groups
          .flatMap(({ t, items }) => items.map((m) => ({ m, s: squash(m.reference).startsWith(squash(t)) ? 2 : 1 })))
          .sort((a, b) => b.s - a.s)
          .map((x) => x.m)
          .filter((m) => !seen.has(m.id) && (seen.add(m.id), true));
        setCandidates(ranked.slice(0, 8));
        if (ranked[0]) setModel(ranked[0]);
      })
      .finally(() => setFinding(false));
  }, [clip]);

  const fee = useMemo(() => (Number(form.price) > 0 ? feeBreakdown(Number(form.price), form.sourceId) : null), [form.price, form.sourceId]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!model) return setError('Choose which watch this listing is for.');
    setBusy(true);
    setError('');
    try {
      if (kind === 'retail') await onSave('retail', { modelId: model.id, price: Number(form.price), currency: form.currency, asOf: form.observedAt, url: form.url || undefined, source: (clip?.site || '').replace(/^www\./, '') || undefined });
      else await onSave('observation', { ...form, modelId: model.id, price: Number(form.price), title: form.title || undefined });
      history.replaceState(null, '', location.pathname + location.search);
      onNavigate({ view: 'watch', id: model.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  if (!clip)
    return (
      <div className="account">
        <div className="account-head">
          <div>
            <p className="eyebrow">SAVE FROM ANY WEBSITE</p>
            <h1>Save to WatchLedger</h1>
            <p className="subtitle">Collect prices from Chrono24, Facebook groups and any other site while you browse.</p>
          </div>
        </div>
        {error && <p className="notice error">{error}</p>}
        <section className="panel clip-panel"><BookmarkletInstall /></section>
      </div>
    );

  return (
    <div className="account clip">
      <button className="text-btn" onClick={() => onNavigate({ view: 'home' })}><ArrowLeft size={14} />Back to search</button>
      <div className="account-head">
        <div>
          <p className="eyebrow">SAVED FROM {String(clip.site || '').toUpperCase()}</p>
          <h1>Add this listing</h1>
          <p className="subtitle clip-title">{clip.title || clip.url}</p>
        </div>
      </div>
      <div className="clip-grid">
        <section className="panel clip-panel">
          <h2><MousePointerClick size={16} />Which watch is it?</h2>
          {finding ? <p className="muted-line">Looking for references in the listing…</p> : candidates.length ? (
            <div className="clip-candidates">
              {candidates.map((m) => (
                <button type="button" key={m.id} className={model?.id === m.id ? 'active' : ''} onClick={() => setModel(m)}>
                  <span className="suggestion-thumb"><WatchPhoto model={m} credit={false} iconSize={18} /></span>
                  <span><strong>{m.brand} {m.name}</strong><small>Ref. {m.reference}</small></span>
                  {model?.id === m.id && <Check size={16} />}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted-line">No reference found in the listing text. Search for the watch below.</p>
          )}
          <div className="clip-search">
            <SearchBox
              variant="compact"
              brands={brands}
              onPickWatch={(m) => { setModel(m); setCandidates((c) => [m, ...c.filter((x) => x.id !== m.id)].slice(0, 8)); }}
              onPickBrand={() => {}}
              onSubmit={(q) => fetch(`/api/catalog?${new URLSearchParams({ q, limit: '8' })}`).then((r) => r.json()).then((d: any) => { setCandidates(d.items || []); if (d.items?.[0]) setModel(d.items[0]); })}
            />
            <small><Search size={11} /> Type a model or reference, then pick it from the suggestions.</small>
          </div>
          {clip.text && (
            <details className="clip-text">
              <summary>Text captured from the page</summary>
              <p>{clip.text}</p>
            </details>
          )}
        </section>

        <form className="panel clip-panel clip-form" onSubmit={submit}>
          <h2>Price details</h2>
          <div className="kind-toggle" role="radiogroup" aria-label="Save as">
            <button type="button" role="radio" aria-checked={kind === 'observation'} className={kind === 'observation' ? 'on' : ''} onClick={() => setKind('observation')}>Market price (listing or sale)</button>
            <button type="button" role="radio" aria-checked={kind === 'retail'} className={kind === 'retail' ? 'on' : ''} onClick={() => setKind('retail')}>Retail price (brand / dealer)</button>
          </div>
          {kind === 'retail' && <p className="fee-live">Saved as the official retail price{clip.site ? ` from ${clip.site.replace(/^www\./, '')}` : ''}. It is used for value retention and shown in the price box.</p>}
          {kind === 'observation' && <label>Source<select value={form.sourceId} onChange={set('sourceId')}>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
          <div className="form-grid">
            <label>Price{form.sourceId === 'chrono24' && <span className="optional">listed price, incl. fees</span>}<input type="number" min="0.01" step="0.01" required value={form.price} onChange={set('price')} placeholder="0.00" /></label>
            <label>Currency<select value={form.currency} onChange={set('currency')}>{currencies.map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
          {fee && (
            <p className="fee-live">
              Buyer pays <strong>{money(fee.listed, form.currency)}</strong> · Chrono24 keeps 6.95% ({money(fee.commission, form.currency)}) · seller receives <strong>{money(fee.sellerNet, form.currency)}</strong>
            </p>
          )}
          {kind === 'observation' && (<>
          <div className="form-grid">
            <label>Price type<select value={form.status} onChange={set('status')}>{Object.entries(statuses).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>Date seen<input type="date" max={today()} value={form.observedAt} onChange={set('observedAt')} required /></label>
          </div>
          <div className="form-grid">
            <label>Seller country<select value={form.country} onChange={set('country')}>{Object.entries(countries).sort(([a, an], [b, bn]) => (a === 'UNKNOWN' ? -1 : b === 'UNKNOWN' ? 1 : an.localeCompare(bn))).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
            <label>Seller type<select value={form.sellerType} onChange={set('sellerType')}><option value="private">Private seller</option><option value="dealer">Dealer</option><option value="unknown">Unknown</option></select></label>
          </div>
          <div className="form-grid">
            <label>Condition<select value={form.condition} onChange={set('condition')}><option value="used">Pre-owned</option><option value="new">New / unworn</option><option value="unknown">Unknown</option></select></label>
            <label>Box & papers<select value={form.contents} onChange={set('contents')}><option value="unknown">Unknown</option><option value="full-set">Box and papers</option><option value="watch-only">Watch only</option></select></label>
          </div>
          </>)}
          {kind === 'retail' && <label>As of<input type="date" max={today()} value={form.observedAt} onChange={set('observedAt')} required /></label>}
          <label>{kind === 'retail' ? 'Page link' : 'Listing link'}<input type="url" value={form.url} onChange={set('url')} maxLength={2000} /></label>
          {error && <p role="alert" className="error-text">{error}</p>}
          <div className="form-actions">
            <button className="primary" disabled={busy || !model}>{busy ? 'Saving…' : model ? `Save ${kind === 'retail' ? 'retail price' : 'price'} for ${model.brand} ${model.reference}` : 'Choose a watch first'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
