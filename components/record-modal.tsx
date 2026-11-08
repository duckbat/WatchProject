'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { countries, currencies, feeBreakdown, money, watchPhotos, type Model } from '../lib/market';
import { statuses, today, type ModalKind } from './shared';

type Source = { id: string; name: string; country?: string };
type Props = {
  kind: Exclude<ModalKind, ''>;
  models: Model[];
  selected: string;
  sources: Source[];
  currency: string;
  onClose: () => void;
  onOpen: (k: ModalKind) => void;
  onSave: (kind: string, data: Record<string, unknown>) => Promise<void>;
};

const titles: Record<string, string> = { owned: 'Add a watch you own', observation: 'Record a market price', source: 'Add a marketplace source', model: 'Track a new reference', about: 'How prices work' };

export default function RecordModal({ kind, models, selected, sources, currency, onClose, onOpen, onSave }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [obs, setObs] = useState({ sourceId: sources[0]?.id || '', price: '', currency });
  const fee = Number(obs.price) > 0 ? feeBreakdown(Number(obs.price), obs.sourceId) : null;
  const countryOptions = Object.entries(countries)
    .sort(([a, an], [b, bn]) => (a === 'UNKNOWN' ? 1 : b === 'UNKNOWN' ? -1 : an.localeCompare(bn)))
    .map(([code, name]) => <option key={code} value={code}>{name}</option>);
  const modelSelect = (
    <label>Watch model<select name="modelId" defaultValue={selected}>{models.map((m) => <option key={m.id} value={m.id}>{m.brand} {m.name} · {m.reference}</option>)}</select></label>
  );
  const currencySelect = <label>Currency<select name="currency" defaultValue={currency}>{currencies.map((c) => <option key={c}>{c}</option>)}</select></label>;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data: any = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (kind === 'source') data.mode = 'Manual observations';
    if (kind === 'model') { data.color = '#344d47'; data.size = ''; }
    if (kind === 'owned') data.cost = Number(data.cost);
    if (kind === 'observation') data.price = Number(data.price);
    try {
      await onSave(kind, data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <button className="close icon-btn" aria-label="Close dialog" onClick={onClose} disabled={busy}><X size={21} /></button>
        <p className="eyebrow">YOUR WATCHLEDGER</p>
        <h2 id="dialog-title">{titles[kind]}</h2>
        {kind === 'about' ? (
          <div className="about">
            <p>WatchLedger is a personal price search and tracker. It has no selling or checkout features.</p>
            <h3>Market price</h3>
            <p>Each watch page checks Tori.fi, FINN.no, Blocket and DBA live, sale forums through WatchRecon, the WatchUSeek feed, and eBay when API credentials are configured. The market price is the median or average of listings that name this reference, in the selected currency and region. Catalog variants such as 126200-0001 also use listings that only say 126200 (labelled), unless they name a different dial; with 3 or more complete-variant prices only those are used. Cross-posts count once and far-off prices are excluded. Similar listings from the same model line are shown separately and never used for the price.</p>
            <h3>Your observations</h3>
            <p>Bookmark a live listing or record a price manually to build a dated history. Current comparisons use the latest observation per listing URL to avoid overweighting listings collected repeatedly. EUR, USD, GBP and CHF are never combined or converted.</p>
            <h3>Asking is different from sold</h3>
            <p>“Confirmed sale” means you know the transaction price. “Sold · last ask” means the watch sold but only its asking price is known. Neither a removed listing nor a sold badge proves the final price.</p>
            <h3>Understand the limits</h3>
            <p>Charts plot only observed prices; they do not reconstruct missing history. Chrono24 blocks automated access, and Reddit and Facebook groups are not connected. Box, papers, condition and seller type affect price; no automatic valuation adjustment is applied. A small sample is not a reliable appraisal.</p>
            <h3>Reference catalog</h3>
            <p>Browse the imported Timepiecepedia reference catalog (CC0 metadata). Coverage is incomplete and specifications have not been independently verified. Image rights are separate.</p>
            <p><a href="https://github.com/timepiecepedia/timepiecepedia-data" target="_blank" rel="noreferrer">Timepiecepedia dataset and license ↗</a></p>
            <h3>Watch photography</h3>
            <p>{Object.entries(watchPhotos).map(([id, p]) => <span key={id}><a href={p.page} target="_blank" rel="noreferrer">{models.find((m) => m.id === id)?.brand} · {p.source} ↗</a><br /></span>)}</p>
          </div>
        ) : (
          <form onSubmit={submit} onChange={(e) => { const t = e.target as unknown as HTMLInputElement; if (kind === 'observation' && ['sourceId', 'price', 'currency'].includes(t.name)) setObs((o) => ({ ...o, [t.name]: t.value })); }}>
            <p className="form-intro">{kind === 'owned' ? 'Keep a purchase record and compare it with market prices.' : kind === 'source' ? 'Save a marketplace or group you follow. This creates a manual tracking source, not an automatic feed.' : kind === 'model' ? 'Use an exact reference so different watch variants don’t get mixed together.' : 'Add a price you saw on an external marketplace. Nothing is listed for sale here.'}</p>
            {(kind === 'owned' || kind === 'observation') && modelSelect}
            {kind === 'owned' && (
              <>
                <div className="form-grid"><label>Purchase price<input name="cost" type="number" min="0" max="1000000000" step="0.01" required placeholder="0.00" /></label>{currencySelect}</div>
                <label>Purchase date<input type="date" name="purchaseDate" defaultValue={today()} max={today()} required /></label>
                <button type="button" className="text-btn" onClick={() => onOpen('model')}>Can’t find your watch? Add its reference first.</button>
              </>
            )}
            {kind === 'source' && (
              <>
                <label>Source name<input name="name" required maxLength={160} placeholder="e.g. Finnish watch collectors" /></label>
                <label>Marketplace or group URL<input name="url" type="url" maxLength={2000} placeholder="https://www.facebook.com/groups/…" required /></label>
                <label>Default seller country<select name="country" defaultValue="FI"><option value="">Multiple countries / unknown</option>{countryOptions}</select></label>
              </>
            )}
            {kind === 'model' && (
              <>
                <label>Brand<input name="brand" required maxLength={160} placeholder="e.g. Longines" /></label>
                <label>Model name<input name="name" required maxLength={160} placeholder="e.g. Spirit Zulu Time" /></label>
                <label>Photo URL <span className="optional">optional · use an image you have permission to display</span><input name="imageUrl" type="url" placeholder="https://…" maxLength={2000} /></label>
                <label>Exact reference<input name="reference" required maxLength={160} placeholder="e.g. L3.802.4.63.6" /></label>
              </>
            )}
            {kind === 'observation' && (
              <>
                <label>Source<select name="sourceId" defaultValue={sources[0]?.id}>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <div className="form-grid"><label>Observed price{obs.sourceId === 'chrono24' && <span className="optional">listed price, incl. fees</span>}<input name="price" type="number" min="0.01" max="1000000000" step="0.01" required placeholder="0.00" /></label>{currencySelect}</div>
                {obs.sourceId === 'chrono24' && (
                  <p className="fee-live">
                    {fee ? (
                      <>Buyer pays <strong>{money(fee.listed, obs.currency)}</strong> · Chrono24 keeps 6.95% ({money(fee.commission, obs.currency)}) · seller receives <strong>{money(fee.sellerNet, obs.currency)}</strong></>
                    ) : (
                      <>Chrono24 keeps 6.95% of the sale. Enter the listed price to see what the seller receives.</>
                    )}
                  </p>
                )}
                <div className="form-grid"><label>Seller country<select name="country" defaultValue="UNKNOWN">{countryOptions}</select></label><label>Date observed<input name="observedAt" type="date" max={today()} defaultValue={today()} required /></label></div>
                <label>Price type<select name="status" defaultValue="asking">{Object.entries(statuses).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <div className="form-grid"><label>Condition<select name="condition"><option value="used">Pre-owned</option><option value="new">New / unworn</option></select></label><label>Seller type<select name="sellerType"><option value="private">Private seller</option><option value="dealer">Dealer</option></select></label></div>
                <label>Box & papers<select name="contents"><option value="unknown">Unknown</option><option value="full-set">Box and papers</option><option value="watch-only">Watch only</option></select></label>
                <label>Listing URL <span className="optional">optional</span><input name="url" type="url" maxLength={2000} placeholder="https://…" /></label>
                <p className="fine">Use the final transaction price only when confirmed. Avoid recording the same watch’s cross-posted listing more than once.</p>
              </>
            )}
            {error && <p role="alert" className="error-text">{error}</p>}
            <div className="form-actions">
              <button className="secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="primary" disabled={busy}>{busy ? 'Saving…' : kind === 'observation' ? 'Save observation' : kind === 'source' ? 'Save source' : kind === 'model' ? 'Add reference' : 'Add to collection'}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
