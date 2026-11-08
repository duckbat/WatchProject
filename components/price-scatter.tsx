'use client';
import { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { money } from '../lib/market';

export type ChartKind = 'live' | 'similar' | 'asking' | 'confirmed-sale' | 'sold-asking';
export type ChartPoint = { id: string; date: string; price: number; kind: ChartKind; title: string; url?: string; source: string; country: string; undated?: boolean };

export const kindStyle: Record<ChartKind, { label: string; color: string; hollow?: boolean }> = {
  live: { label: 'Asking', color: 'var(--c-asking)' },
  asking: { label: 'Asking (last observed)', color: '#7ea6e6' },
  'confirmed-sale': { label: 'Reported sale', color: 'var(--c-sold)' },
  'sold-asking': { label: 'Sold (last ask)', color: '#f2a07b' },
  similar: { label: 'Similar models', color: 'var(--c-similar)', hollow: true },
};

const W = 900, H = 330, L = 74, R = 18, T = 18, B = 36;
const DAY = 86_400_000;

function niceTicks(min: number, max: number, count = 5) {
  if (min === max) {
    min = min * 0.9;
    max = max * 1.1 || 1;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return ticks;
}

export default function PriceScatter({ points, currency, period, marketPrice }: { points: ChartPoint[]; currency: string; period: string; marketPrice: number | null }) {
  const [hidden, setHidden] = useState<Set<ChartKind>>(new Set());
  const [hover, setHover] = useState<ChartPoint | null>(null);
  const kinds = (Object.keys(kindStyle) as ChartKind[]).filter((k) => points.some((p) => p.kind === k));
  const rangeStart = period === '36500' ? '' : new Date(Date.now() - Number(period) * DAY).toISOString().slice(0, 10);
  const shown = points.filter((p) => !hidden.has(p.kind) && (p.undated || p.date >= rangeStart));

  // Live listings have no history yet, so they get their own "For sale now" column beside the timeline.
  const todayStr = new Date().toISOString().slice(0, 10);
  // Only listings without a known listing date go in the "For sale now" column.
  const inBand = (p: ChartPoint) => (p.kind === 'live' || p.kind === 'similar') && (p.undated || p.date > todayStr);
  const hasLive = points.some(inBand);
  const BAND = hasLive ? 150 : 0;
  const plotEnd = W - R - (BAND ? BAND + 14 : 0);

  const geo = useMemo(() => {
    const end = Date.now();
    const oldest = Math.min(...points.map((p) => +new Date(p.date)), end);
    const start = period === '36500' ? Math.min(oldest - 7 * DAY, end - 30 * DAY) : end - Number(period) * DAY;
    const prices = shown.map((p) => p.price).concat(marketPrice !== null ? [marketPrice] : []);
    const ticks = prices.length ? niceTicks(Math.min(...prices), Math.max(...prices)) : [0, 1];
    const lo = ticks[0], hi = ticks[ticks.length - 1];
    const x = (d: string) => L + ((+new Date(d) - start) / (end - start || 1)) * (plotEnd - L);
    const y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
    const span = end - start;
    const fmt = new Intl.DateTimeFormat('en', span <= 100 * DAY ? { day: 'numeric', month: 'short' } : { month: 'short', year: 'numeric' });
    const xticks = Array.from({ length: 5 }, (_, i) => start + (span * i) / 4);
    return { x, y, ticks, xticks, fmt };
  }, [points, shown, period, marketPrice, plotEnd]);

  // Saved prices sit on the timeline (same-day points nudged apart); live ones are spread across the band.
  const sameDay = new Map<string, number>();
  let liveIndex = 0;
  const placed = shown.map((p) => {
    if (inBand(p)) {
      const frac = ((liveIndex++ * 0.61803) % 1);
      return { p, cx: W - R - BAND + 14 + frac * (BAND - 28), cy: geo.y(p.price) };
    }
    const n = sameDay.get(p.date) || 0;
    sameDay.set(p.date, n + 1);
    const offset = n === 0 ? 0 : (n % 2 ? -1 : 1) * Math.ceil(n / 2) * 5;
    return { p, cx: Math.min(plotEnd - 4, Math.max(L + 4, geo.x(p.date) + offset)), cy: geo.y(p.price) };
  });
  const hovered = hover && placed.find((d) => d.p.id === hover.id);

  return (
    <div className="scatter" onMouseLeave={() => setHover(null)}>
      <div className="scatter-legend" role="group" aria-label="Show or hide price types">
        {kinds.map((k) => (
          <button key={k} className={hidden.has(k) ? 'off' : ''} aria-pressed={!hidden.has(k)} onClick={() => setHidden((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}>
            <span className={`dot${kindStyle[k].hollow ? ' hollow' : ''}`} style={{ '--dot': kindStyle[k].color } as React.CSSProperties} />
            {kindStyle[k].label}
            <small>{points.filter((p) => p.kind === k).length}</small>
          </button>
        ))}
      </div>
      <div className="scatter-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Price chart with ${shown.length} listings and observations`}>
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={geo.y(t)} y2={geo.y(t)} className="grid" />
              <text x={L - 10} y={geo.y(t) + 4} textAnchor="end" className="axis">{money(t, currency)}</text>
            </g>
          ))}
          {geo.xticks.map((t, i) => (
            <text key={t} x={L + ((plotEnd - L) * i) / 4} y={H - 10} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} className="axis">
              {i === 4 ? 'Today' : geo.fmt.format(t)}
            </text>
          ))}
          {BAND > 0 && (
            <g>
              <rect x={W - R - BAND} y={T - 8} width={BAND} height={H - T - B + 16} rx={10} fill="rgba(47,125,87,0.06)" stroke="rgba(47,125,87,0.25)" strokeDasharray="3 4" />
              <text x={W - R - BAND / 2} y={H - 10} textAnchor="middle" className="axis band-label">For sale now</text>
            </g>
          )}
          {marketPrice !== null && (
            <g>
              <line x1={L} x2={W - R} y1={geo.y(marketPrice)} y2={geo.y(marketPrice)} className="market-line" />
              <text x={L + 6} y={geo.y(marketPrice) - 6} className="market-label">Market price {money(marketPrice, currency)}</text>
            </g>
          )}
          {placed.map(({ p, cx, cy }) => {
            const s = kindStyle[p.kind];
            const dot = (
              <circle
                cx={cx}
                cy={cy}
                r={hover?.id === p.id ? 8 : p.kind === 'similar' ? 5 : 6}
                fill={s.hollow ? 'var(--surface)' : s.color}
                stroke={s.hollow ? s.color : 'var(--surface)'}
                strokeWidth={s.hollow ? 2 : 1.5}
              />
            );
            const label = `${p.title}: ${money(p.price, currency)} · ${p.source} · ${p.date}`;
            return p.url ? (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" aria-label={`${label}. Open listing`} onMouseEnter={() => setHover(p)} onFocus={() => setHover(p)} className="pt">
                <circle cx={cx} cy={cy} r={13} fill="transparent" />
                {dot}
              </a>
            ) : (
              <g key={p.id} tabIndex={0} aria-label={label} onMouseEnter={() => setHover(p)} onFocus={() => setHover(p)} className="pt">
                <circle cx={cx} cy={cy} r={13} fill="transparent" />
                {dot}
              </g>
            );
          })}
        </svg>
        {hovered && (
          <div
            className={`scatter-tip${hovered.cx > W * 0.62 ? ' left' : ''}`}
            style={{ left: `${(hovered.cx / W) * 100}%`, top: `${(hovered.cy / H) * 100}%` }}
          >
            <span className="tip-kind" style={{ color: kindStyle[hovered.p.kind].color }}>{kindStyle[hovered.p.kind].label}</span>
            <strong>{money(hovered.p.price, currency)}</strong>
            <p>{hovered.p.title}</p>
            <small>{hovered.p.source} · {hovered.p.country} · {hovered.p.undated ? 'date unknown' : `${hovered.p.kind === 'confirmed-sale' ? 'auction ended' : 'observed / listed'} ${hovered.p.date}`}</small>
            {hovered.p.url && (
              <a href={hovered.p.url} target="_blank" rel="noreferrer">
                Go to listing <ArrowUpRight size={13} />
              </a>
            )}
          </div>
        )}
      </div>
      <p className="scatter-foot">Click a dot to open that listing. Only observed prices are plotted — no estimated history.</p>
    </div>
  );
}
