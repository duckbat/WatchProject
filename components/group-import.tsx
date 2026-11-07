'use client';
import { useMemo, useState } from 'react';
import { ArrowRight, Check, ClipboardPaste, ExternalLink, Loader2, X } from 'lucide-react';
import { countries, currencies, money, type Entry, type Model } from '../lib/market';
import { extractPrice } from '../lib/collectors';
import { isSold, parsePostDate, postLink, splitPosts } from '../lib/post-import';
import { today, type Route } from './shared';

type Source = { id: string; name: string; url?: string };
type Row = { id: number; text: string; include: boolean; modelId: string; candidates: Model[]; price: string; currency: string; date: string; datedFromPost: boolean; status: 'asking' | 'sold-asking'; link: string | null; result?: 'saved' | 'duplicate' | 'error'; message?: string };

export default function GroupImport({ sources, entries, onSave, onNavigate }: { sources: Source[]; entries: Entry[]; onSave: (kind: string, data: Record<string, unknown>) => Promise<void>; onNavigate: (r: Route) => void }) {
  const groups = sources.filter((s) => /facebook\.com\/groups\/[\w.]+/i.test(s.url || ''));
  const [sourceId, setSourceId] = useState(groups[0]?.id || 'facebook');
  const [currency, setCurrency] = useState('EUR');
  const [country, setCountry] = useState('FI');
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const source = sources.find((s) => s.id === sourceId);

  async function read() {
    setBusy(true);
    setError('');
    try {
      const posts = splitPosts(text);
      if (!posts.length) throw new Error('No posts found in the pasted text.');
      const r = await fetch('/api/catalog/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texts: posts.map((p) => p.slice(0, 4000)) }) });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not match references');
      setRows(
        posts.map((p, i) => {
          const price = extractPrice(p, currency);
          const date = parsePostDate(p);
          const candidates: Model[] = d.matches[i] || [];
          return {
            id: i, text: p, candidates, modelId: candidates[0]?.id || '',
            price: price ? String(price.price) : '', currency: price?.currency || currency,
            date: date && date <= today() ? date : today(), datedFromPost: Boolean(date),
            status: isSold(p) ? 'sold-asking' : 'asking', link: postLink(p),
            include: Boolean(price && candidates.length),
          };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the posts');
    } finally {
      setBusy(false);
    }
  }

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs && rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const selected = useMemo(() => (rows || []).filter((r) => r.include && r.modelId && Number(r.price) > 0 && !r.result), [rows]);
  const isDuplicate = (r: Row) =>
    entries.some((e) => e.kind === 'observation' && e.data.modelId === r.modelId && e.data.sourceId === sourceId && e.data.price === Number(r.price) && e.data.observedAt === r.date);

  async function saveAll() {
    setBusy(true);
    for (const r of selected) {
      if (isDuplicate(r)) { update(r.id, { result: 'duplicate', message: 'Already saved' }); continue; }
      try {
        await onSave('observation', {
          modelId: r.modelId, sourceId, country, currency: r.currency, price: Number(r.price), status: r.status, observedAt: r.date,
          condition: /\b(new|unworn|uusi|käyttämätön|bnib)\b/i.test(r.text) ? 'new' : 'unknown', sellerType: 'private',
          contents: /\b(full ?set|box (and|&) papers|laatikko ja paperit|fullset)\b/i.test(r.text) ? 'full-set' : 'unknown',
          url: r.link || '', title: r.text.replace(/\s+/g, ' ').slice(0, 300),
        });
        update(r.id, { result: 'saved' });
      } catch (e) {
        update(r.id, { result: e instanceof Error && /already/i.test(e.message) ? 'duplicate' : 'error', message: e instanceof Error ? e.message : 'Failed' });
      }
    }
    setBusy(false);
  }

  const savedRows = (rows || []).filter((r) => r.result === 'saved');
  return (
    <div className="account import">
      <div className="account-head">
        <div>
          <p className="eyebrow">IMPORT PRICES</p>
          <h1>Import posts from a group</h1>
          <p className="subtitle">Paste posts from a Facebook group (or any forum). WatchLedger finds the reference, price and date in each post; you check them before saving.</p>
        </div>
      </div>

      <section className="panel clip-panel">
        <ol className="import-steps">
          <li>Open the group{source?.url && <> (<a href={source.url} target="_blank" rel="noreferrer">{source.name} <ExternalLink size={11} /></a>)</>}, or its search for a watch, while signed in to Facebook. Scroll until the posts you want are loaded.</li>
          <li>Select the posts (or press ⌘A / Ctrl+A) and copy.</li>
          <li>Paste below and click <strong>Find prices</strong>.</li>
        </ol>
        <div className="import-settings clip-form">
          <label>Source<select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Currency when only a number is given<select value={currency} onChange={(e) => setCurrency(e.target.value)}>{currencies.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Seller country<select value={country} onChange={(e) => setCountry(e.target.value)}>{Object.entries(countries).sort(([, a], [, b]) => a.localeCompare(b)).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
        </div>
        <textarea className="import-text" placeholder="Paste the copied posts here…" value={text} onChange={(e) => setText(e.target.value)} rows={8} />
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="primary" disabled={busy || text.trim().length < 10} onClick={read}>
          {busy && !rows ? <Loader2 size={15} className="spin" /> : <ClipboardPaste size={15} />}Find prices
        </button>
      </section>

      {rows && (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>{rows.length} posts found <span className="count-pill">{rows.filter((r) => r.include).length} selected</span></h2>
              <p>Posts with a price and a recognised reference are selected. Pick the right variant, fix anything that looks wrong, then save.</p>
            </div>
            <button className="primary" disabled={busy || !selected.length} onClick={saveAll}>
              {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />}Save {selected.length} price{selected.length === 1 ? '' : 's'}
            </button>
          </div>
          {savedRows.length > 0 && (
            <p className="notice import-done">
              Saved {savedRows.length} price{savedRows.length === 1 ? '' : 's'}.{' '}
              <button className="text-btn" onClick={() => onNavigate({ view: 'watch', id: savedRows[0].modelId })}>Open {savedRows[0].candidates.find((m) => m.id === savedRows[0].modelId)?.reference} <ArrowRight size={13} /></button>
            </p>
          )}
          <div className="table-scroll">
            <table className="import-table">
              <thead><tr><th /><th>Post</th><th>Watch</th><th>Price</th><th>Date</th><th>Type</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.include ? '' : 'off'}>
                    <td><input type="checkbox" aria-label="Include this post" checked={r.include} disabled={Boolean(r.result)} onChange={(e) => update(r.id, { include: e.target.checked })} /></td>
                    <td className="import-post"><details><summary>{r.text.replace(/\s+/g, ' ').slice(0, 110)}{r.text.length > 110 ? '…' : ''}</summary><p>{r.text}</p></details>{r.link && <a href={r.link} target="_blank" rel="noreferrer">Post <ExternalLink size={11} /></a>}</td>
                    <td>
                      {r.candidates.length ? (
                        <select value={r.modelId} onChange={(e) => update(r.id, { modelId: e.target.value })}>
                          {r.candidates.map((m) => <option key={m.id} value={m.id}>{m.brand} {m.reference} · {m.name.slice(0, 40)}</option>)}
                        </select>
                      ) : <small className="muted">No reference found</small>}
                    </td>
                    <td className="import-price">
                      <input type="number" min="1" value={r.price} onChange={(e) => update(r.id, { price: e.target.value })} aria-label="Price" />
                      <select value={r.currency} onChange={(e) => update(r.id, { currency: e.target.value })} aria-label="Currency">{currencies.map((c) => <option key={c}>{c}</option>)}</select>
                    </td>
                    <td><input type="date" max={today()} value={r.date} onChange={(e) => update(r.id, { date: e.target.value })} aria-label="Date" />{!r.datedFromPost && <small className="muted">no date in post</small>}</td>
                    <td><select value={r.status} onChange={(e) => update(r.id, { status: e.target.value as Row['status'] })} aria-label="Price type"><option value="asking">Asking</option><option value="sold-asking">Sold · last ask</option></select></td>
                    <td>
                      {r.result === 'saved' && <span className="import-ok"><Check size={14} />Saved</span>}
                      {r.result === 'duplicate' && <span className="muted">Already saved</span>}
                      {r.result === 'error' && <span className="import-err" title={r.message}><X size={14} />{r.message}</span>}
                      {!r.result && Number(r.price) > 0 && <small className="muted">{money(Number(r.price), r.currency)}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
