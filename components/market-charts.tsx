'use client';
import { useState } from 'react';
import { Check, Info, Minus, X } from 'lucide-react';
import type { Metrics } from '../lib/metrics';

const W = 900, H = 260, L = 50, R = 16, T = 16, B = 34;

type Bar = { label: string; parts: { value: number; color: string; name: string }[]; hint?: string };

function Bars({ bars, unit }: { bars: Bar[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.parts.reduce((n, p) => n + p.value, 0)));
  const step = Math.max(1, Math.ceil(max / 4));
  const top = step * 4;
  const bw = (W - L - R) / Math.max(bars.length, 1);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  return (
    <div className="bars">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={bars.map((b) => `${b.label}: ${b.parts.map((p) => `${p.value} ${p.name}`).join(', ')}`).join('; ')} onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(i * step)} y2={y(i * step)} stroke="var(--line-2)" />
            <text x={L - 8} y={y(i * step) + 4} textAnchor="end" className="axis">{i * step}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          let acc = 0;
          return (
            <g key={b.label} onMouseEnter={() => setHover(i)}>
              <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill={hover === i ? 'var(--line-2)' : 'transparent'} opacity={0.6} />
              {b.parts.map((p) => {
                const y0 = y(acc), y1 = y(acc + p.value);
                acc += p.value;
                return p.value ? <rect key={p.name} x={L + i * bw + bw * 0.18} y={y1} width={bw * 0.64} height={y0 - y1} rx={3} fill={p.color} /> : null;
              })}
              {(bars.length <= 14 || i % Math.ceil(bars.length / 12) === 0) && (
                <text x={L + i * bw + bw / 2} y={H - 10} textAnchor="middle" className="axis">{b.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="bars-foot">
        {hover !== null ? (
          <>
            <strong>{bars[hover].hint || bars[hover].label}</strong>: {bars[hover].parts.map((p) => `${p.value} ${p.name}`).join(' · ')}
          </>
        ) : (
          `Hover a bar for details · ${unit}`
        )}
      </p>
    </div>
  );
}

/** Listings and sales per month (or week for short ranges), split sold / unsold. */
export function VolumeChart({ points, period }: { points: { date: string; sold: boolean }[]; period: string }) {
  const weekly = Number(period) <= 90;
  const days = period === '36500' ? Math.max(365, ...points.map((p) => (Date.now() - +new Date(p.date)) / 86_400_000)) : Number(period);
  const keys: string[] = [];
  const end = new Date();
  for (let d = new Date(end.getTime() - days * 86_400_000); d <= end; d.setUTCDate(d.getUTCDate() + (weekly ? 7 : 1))) {
    const k = weekly ? new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10) : d.toISOString().slice(0, 7);
    if (!keys.includes(k)) keys.push(k);
  }
  const keyOf = (date: string) => (weekly ? new Date(+new Date(date + 'T00:00:00Z') - ((new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10) : date.slice(0, 7));
  const bars: Bar[] = keys.map((k) => {
    const xs = points.filter((p) => keyOf(p.date) === k);
    const d = new Date((weekly ? k : k + '-01') + 'T00:00:00Z');
    return {
      label: d.toLocaleDateString('en-GB', weekly ? { day: 'numeric', month: 'short' } : { month: 'short' }),
      hint: weekly ? `Week of ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      parts: [
        { name: 'sold', value: xs.filter((p) => p.sold).length, color: 'var(--c-sold)' },
        { name: 'listed', value: xs.filter((p) => !p.sold).length, color: 'var(--c-asking)' },
      ],
    };
  });
  if (!points.length) return <p className="muted-line">No dated listings in this range yet.</p>;
  return <Bars bars={bars} unit={`listings and sales per ${weekly ? 'week' : 'month'}`} />;
}

/** How long the listings currently for sale have been listed. */
export function DaysChart({ ages }: { ages: number[] }) {
  const bins: [string, number, number][] = [['0–7', 0, 7], ['8–14', 8, 14], ['15–30', 15, 30], ['31–60', 31, 60], ['61–90', 61, 90], ['91–180', 91, 180], ['180+', 181, Infinity]];
  if (!ages.length) return <p className="muted-line">No active listings with a known listing date.</p>;
  return (
    <Bars
      unit="active listings by days listed"
      bars={bins.map(([label, lo, hi]) => ({ label: `${label} d`, hint: `Listed ${label} days`, parts: [{ name: 'listings', value: ages.filter((a) => a >= lo && a <= hi).length, color: 'var(--c-asking)' }] }))}
    />
  );
}

const pct = (x: number | null, sign = true) => (x === null ? '—' : `${sign && x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`);

export function MetricsGrid({ m, hasRetail, onRetail }: { m: Metrics; hasRetail: boolean; onRetail: () => void }) {
  const cards: [string, string, string, React.ReactNode?][] = [
    [m.volatility === null ? '—' : `${(m.volatility * 100).toFixed(1)}%`, 'Market volatility', 'How much the weekly median price moved over the last year (coefficient of variation). Needs 3+ weeks with prices.'],
    [m.risk ? `${m.risk.score}/100` : '—', 'Risk score', 'Short-term depreciation risk from volatility, 1-year trend, market liquidity and price vs retail. Lower is safer.'],
    [
      pct(m.valueRetention),
      'Value retention',
      'Market price compared with the retail price you entered.',
      !hasRetail && <button className="text-btn" onClick={onRetail}>Add retail price</button>,
    ],
    [m.inception ? new Date(m.inception + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—', 'Market inception', 'Date of the earliest price WatchLedger has for this reference.'],
    [m.volume1y.toLocaleString('en'), '1Y volume', `Listings and sales seen in the last year (${m.sold1y} marked sold).`],
    [m.medianDaysListed === null ? '—' : String(m.medianDaysListed), 'Median days listed', 'Median age of the listings currently for sale, from their listing date.'],
  ];
  return (
    <div className="metrics-grid">
      {cards.map(([value, label, help, extra]) => (
        <article key={label} className="metric">
          <strong>{value}</strong>
          <span>
            {label}
            <span className="info" title={help} aria-label={help} role="img"><Info size={13} /></span>
          </span>
          {extra}
        </article>
      ))}
    </div>
  );
}

export function RiskPanel({ m, reference }: { m: Metrics; reference: string }) {
  if (!m.risk) return null;
  const { score, label, checks } = m.risk;
  const tone = score < 34 ? 'low' : score < 67 ? 'mid' : 'high';
  return (
    <section className="panel risk-panel">
      <div className="risk-intro">
        <h2>Risk score</h2>
        <p>The risk score estimates short-term depreciation risk when buying this watch on the secondary market, from the prices WatchLedger has seen.</p>
        <p>
          The {reference} has a risk score of <strong>{score}/100</strong>, indicating <strong className={`risk-word ${tone}`}>{label.toLowerCase()}</strong>.
        </p>
      </div>
      <div className="risk-gauge" aria-hidden>
        <div className="risk-track"><span className={`risk-fill ${tone}`} style={{ width: `${score}%` }} /></div>
        <div className="risk-scale"><span>Low</span><span>Moderate</span><span>High</span></div>
      </div>
      <ul className="risk-checks">
        {checks.map((c) => (
          <li key={c.label}>
            <span className={`risk-icon ${c.ok === null ? 'na' : c.ok ? 'ok' : 'bad'}`}>{c.ok === null ? <Minus size={13} /> : c.ok ? <Check size={13} /> : <X size={13} />}</span>
            <span>
              <strong>{c.label}</strong>
              <small>{c.detail}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
