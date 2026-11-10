'use client';
import { useMemo, useState } from 'react';
import { classifyMatch } from '../lib/collectors/matching/classify';
import { parseEbaySoldCards, type EbayCard } from '../lib/ebay-sold-page';
import { countries, currencies, money, type Model } from '../lib/market';
import { statuses } from './shared';

const supported = (currency: string) => (currencies as readonly string[]).includes(currency);

/**
 * The sales on an eBay sold-items search page, captured by the Save to WatchLedger button. Each sale is checked
 * against the chosen watch; complete- and same-reference matches are ticked, other models are listed but left out.
 */
export default function EbaySoldImport({ cards, model, onSave, onDone }: { cards: EbayCard[]; model: Model | null; onSave: (kind: string, data: Record<string, unknown>) => Promise<void>; onDone: () => void }) {
  const items = useMemo(() => parseEbaySoldCards(cards), [cards]);
  const rows = useMemo(() => items.map((it) => ({ ...it, match: model ? classifyMatch(it.title, model) : null })), [items, model]);
  // The user's ticks belong to one watch; choosing another watch starts again from its matching sales.
  const [ticks, setTicks] = useState<{ modelId?: string; urls: Set<string> } | null>(null);
  const matching = useMemo(() => new Set(rows.filter((r) => (r.match === 'exact' || r.match === 'reference') && supported(r.currency)).map((r) => r.url)), [rows]);
  const picked = ticks && ticks.modelId === model?.id ? ticks.urls : matching;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  async function save() {
    if (!model) return;
    setBusy(true);
    setResult('');
    let saved = 0, skipped = 0, failed = 0;
    for (const r of rows.filter((x) => picked.has(x.url))) {
      try {
        await onSave('observation', { modelId: model.id, sourceId: 'ebay', country: r.country in countries ? r.country : 'UNKNOWN', currency: r.currency, price: r.price, status: r.status, observedAt: r.soldAt, condition: r.condition, sellerType: 'unknown', contents: 'unknown', url: r.url, title: r.title });
        saved++;
      } catch (e) {
        if (e instanceof Error && /already recorded/i.test(e.message)) skipped++;
        else failed++;
      }
    }
    setBusy(false);
    setResult(`${saved} sale${saved === 1 ? '' : 's'} saved${skipped ? `, ${skipped} already recorded` : ''}${failed ? `, ${failed} could not be saved` : ''}.`);
    if (saved && !failed) onDone();
  }

  const toggle = (url: string) => {
    const n = new Set(picked);
    if (n.has(url)) n.delete(url);
    else n.add(url);
    setTicks({ modelId: model?.id, urls: n });
  };
  const label = (m: string | null) => (m === 'exact' ? 'Exact reference' : m === 'reference' ? 'Same reference' : m === 'similar' ? 'Similar model' : 'Other watch');

  return (
    <section className="panel clip-panel ebay-sold">
      <h2>Sold on eBay</h2>
      {!items.length ? (
        <p className="fee-live">No sold items were found on that page. On eBay, tick <strong>Sold items</strong> under the filters (the URL then contains <code>LH_Sold=1</code>) and click the bookmark again.</p>
      ) : (
        <>
          <p className="fee-live">
            {items.length} sold item{items.length === 1 ? '' : 's'} on the page. Prices are saved as eBay shows them. An accepted best offer hides the price paid, so those are saved as <strong>{statuses['sold-asking']}</strong>.
          </p>
          {!model && <p className="muted-line">Choose the watch first; matching sales are then ticked.</p>}
          <ul className="ebay-sold-list">
            {rows.map((r) => (
              <li key={r.url} className={picked.has(r.url) ? 'on' : ''}>
                <label>
                  <input type="checkbox" checked={picked.has(r.url)} disabled={!model || !supported(r.currency)} onChange={() => toggle(r.url)} />
                  <span>
                    <a href={r.url} target="_blank" rel="noreferrer">{r.title}</a>
                    <small>
                      {r.soldAt} · {statuses[r.status]} · {countries[r.country] || 'Location not stated'} · <span className={`tag ${r.match === 'exact' || r.match === 'reference' ? '' : 'muted'}`}>{label(r.match)}</span>
                      {!supported(r.currency) && ' · currency not supported'}
                    </small>
                  </span>
                  <strong>{supported(r.currency) ? money(r.price, r.currency) : `${r.price} ${r.currency}`}</strong>
                </label>
              </li>
            ))}
          </ul>
          {result && <p role="status" className="fee-live">{result}</p>}
          <div className="form-actions">
            <button className="primary" type="button" disabled={busy || !model || !picked.size} onClick={save}>
              {busy ? 'Saving…' : model ? `Save ${picked.size} sale${picked.size === 1 ? '' : 's'} for ${model.brand} ${model.reference}` : 'Choose a watch first'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
