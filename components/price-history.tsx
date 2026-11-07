'use client';
import { useMemo, useRef, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { money, summarize } from '../lib/market';

export type HistoryPrice = { date: string; price: number };
type Bucket = { start: string; value: number; n: number; low: number; high: number };

const W = 900, H = 260, L = 74, R = 18, T = 16, B = 32;
const DAY = 86_400_000;

function bucketStart(date: string, monthly: boolean) {
  const d = new Date(date + 'T00:00:00Z');
  if (monthly) return `${date.slice(0, 7)}-01`;
  const dow = (d.getUTCDay() + 6) % 7; // Monday-based weeks
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function ticksFor(min: number, max: number) {
  if (min === max) { min *= 0.95; max *= 1.05; }
  const raw = (max - min) / 4, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) out.push(v);
  return out;
}

/** Weekly (or monthly) median of observed exact-reference prices. Weeks without prices are skipped, not invented. */
export default function PriceHistory({ prices, currency, period, method }: { prices: HistoryPrice[]; currency: string; period: string; method: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const monthly = period === '36500';

  const buckets = useMemo<Bucket[]>(() => {
    const groups = new Map<string, number[]>();
    for (const p of prices) {
      const k = bucketStart(p.date, monthly);
      groups.set(k, [...(groups.get(k) || []), p.price]);
    }
    return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([start, xs]) => ({ start, value: summarize(xs, method)!, n: xs.length, low: Math.min(...xs), high: Math.max(...xs) }));
  }, [prices, monthly, method]);

  const geo = useMemo(() => {
    const end = Date.now();
    const first = buckets.length ? +new Date(buckets[0].start) : end;
    const start = period === '36500' ? Math.min(first - 15 * DAY, end - 60 * DAY) : end - Number(period) * DAY;
    const vals = buckets.flatMap((b) => [b.value, b.low, b.high]);
    const ticks = vals.length ? ticksFor(Math.min(...vals), Math.max(...vals)) : [0, 1];
    const lo = ticks[0], hi = ticks[ticks.length - 1];
    const x = (d: string) => L + ((+new Date(d) - start) / (end - start || 1)) * (W - L - R);
    const y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
    const span = end - start;
    const fmt = new Intl.DateTimeFormat('en', span <= 100 * DAY ? { day: 'numeric', month: 'short' } : { month: 'short', year: '2-digit' });
    return { x, y, ticks, lo, xticks: Array.from({ length: 5 }, (_, i) => start + (span * i) / 4), fmt };
  }, [buckets, period]);

  if (!buckets.length)
    return (
      <div className="history-empty">
        <p>No dated prices for this watch in this range yet.</p>
        <small>History builds from r/Watchexchange posts, listing dates and prices you save.</small>
      </div>
    );

  const pts = buckets.map((b) => ({ b, cx: geo.x(b.start), cy: geo.y(b.value) }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].cx.toFixed(1)},${H - B} L${pts[0].cx.toFixed(1)},${H - B} Z`;
  const band = pts.map((p) => `${p.cx.toFixed(1)},${geo.y(p.b.high).toFixed(1)}`).join(' ') + ' ' + [...pts].reverse().map((p) => `${p.cx.toFixed(1)},${geo.y(p.b.low).toFixed(1)}`).join(' ');
  const last = buckets[buckets.length - 1], firstB = buckets[0];
  const change = buckets.length > 1 ? (last.value - firstB.value) / firstB.value : null;
  const total = buckets.reduce((n, b) => n + b.n, 0);
  const h = hover !== null ? pts[hover] : null;
  const label = (b: Bucket) => (monthly ? new Date(b.start + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : `Week of ${new Date(b.start + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p.cx - vx) < Math.abs(pts[best].cx - vx)) best = i; });
    setHover(best);
  }

  return (
    <div className="history">
      <div className="history-summary">
        <strong>{money(last.value, currency)}</strong>
        {change !== null && (
          <span className={`history-change ${change >= 0 ? 'up' : 'down'}`}>
            {change >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            {change >= 0 ? '+' : ''}{(change * 100).toFixed(1)}%
          </span>
        )}
        <small>
          {method === 'median' ? 'Median' : 'Average'} {monthly ? 'per month' : 'per week'} · {total} price{total === 1 ? '' : 's'} in {buckets.length} {monthly ? 'month' : 'week'}{buckets.length === 1 ? '' : 's'}
        </small>
      </div>
      <div className="history-plot">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Price history: ${buckets.map((b) => `${b.start} ${money(b.value, currency)}`).join(', ')}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="history-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--c-live)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--c-live)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--line-2)" />
              <text x={L - 10} y={geo.y(t) + 4} textAnchor="end" className="axis">{money(t, currency)}</text>
            </g>
          ))}
          {geo.xticks.map((t, i) => (
            <text key={t} x={L + ((W - L - R) * i) / 4} y={H - 8} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} className="axis">{i === 4 ? 'Today' : geo.fmt.format(t)}</text>
          ))}
          {pts.length > 1 && <polygon points={band} fill="var(--c-live)" opacity="0.08" />}
          {pts.length > 1 && <path d={area} fill="url(#history-fill)" />}
          {pts.length > 1 && <path d={line} fill="none" stroke="var(--c-live)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {pts.map((p, i) => (
            <circle key={p.b.start} cx={p.cx} cy={p.cy} r={hover === i ? 6 : pts.length > 40 ? 0 : 3.5} fill="var(--c-live)" stroke="var(--surface)" strokeWidth="2" />
          ))}
          {h && (
            <g pointerEvents="none">
              <line x1={h.cx} x2={h.cx} y1={T} y2={H - B} stroke="var(--ink-2)" strokeDasharray="3 4" opacity="0.5" />
              <circle cx={h.cx} cy={h.cy} r={6} fill="var(--c-live)" stroke="var(--surface)" strokeWidth="2" />
            </g>
          )}
          <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" />
        </svg>
        {h && (
          <div className={`scatter-tip history-tip${h.cx > W * 0.62 ? ' left' : ''}`} style={{ left: `${(h.cx / W) * 100}%`, top: `${(h.cy / H) * 100}%` }}>
            <span className="tip-kind">{label(h.b)}</span>
            <strong>{money(h.b.value, currency)}</strong>
            <small>
              {h.b.n} price{h.b.n === 1 ? '' : 's'}
              {h.b.n > 1 && <> · {money(h.b.low, currency)} – {money(h.b.high, currency)}</>}
            </small>
          </div>
        )}
      </div>
      {pts.length === 1 && <p className="fine">Only one {monthly ? 'month' : 'week'} has prices so far; the line appears once there are two.</p>}
    </div>
  );
}
