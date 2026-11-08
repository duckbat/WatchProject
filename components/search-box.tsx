'use client';
import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Clock, Search, Tag, TrendingUp, X } from 'lucide-react';
import { money, type Model } from '../lib/market';
import WatchPhoto from './watch-photo';
import { popularSearches } from './shared';

type Option =
  | { type: 'query'; label: string }
  | { type: 'brand'; label: string; count: number }
  | { type: 'model'; model: Model };

type Props = {
  initial?: string;
  variant: 'hero' | 'compact';
  brands: { brand: string; count: number }[];
  totalCatalog?: number;
  currency?: string;
  autoFocus?: boolean;
  onSubmit: (q: string) => void;
  onPickWatch: (model: Model) => void;
  onPickBrand: (brand: string) => void;
};

const RECENT_KEY = 'watchledger:recent-searches';
function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 5);
  } catch {
    return [];
  }
}
function pushRecent(q: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 5)));
  } catch {}
}

/** Bold the part of the text that matches the typed query. */
function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter((t) => t.length > 0);
  if (!tokens.length) return <>{text}</>;
  const re = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}</>;
}

export default function SearchBox({ initial = '', variant, brands, totalCatalog, currency = 'EUR', autoFocus, onSubmit, onPickWatch, onPickBrand }: Props) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [tracked, setTracked] = useState<Model[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => setValue(initial), [initial]);
  // Shown before typing: the watches with the most market data.
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/catalog?${new URLSearchParams({ popular: '1', limit: '4', currency })}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ items?: Model[] }>) : null))
      .then((d) => setTracked(d?.items || []))
      .catch(() => {});
    return () => controller.abort();
  }, [currency]);

  const q = value.trim();
  useEffect(() => {
    if (q.length < 2) {
      setModels([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/catalog?${new URLSearchParams({ q, limit: '6', currency })}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: any) => setModels(d.items || []))
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 140);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, currency]);

  const brandMatches = q
    ? brands
        .filter((b) => b.brand.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => Number(b.brand.toLowerCase().startsWith(q.toLowerCase())) - Number(a.brand.toLowerCase().startsWith(q.toLowerCase())) || b.count - a.count)
        .slice(0, 3)
    : [];
  const options: Option[] = q
    ? [{ type: 'query', label: q }, ...brandMatches.map((b) => ({ type: 'brand' as const, label: b.brand, count: b.count })), ...models.map((model) => ({ type: 'model' as const, model }))]
    : [
        ...recent.map((label) => ({ type: 'query' as const, label })),
        ...popularSearches.filter((s) => !recent.includes(s)).slice(0, (tracked.length ? 3 : 6) - Math.min(recent.length, 3)).map((label) => ({ type: 'query' as const, label })),
        ...tracked.map((model) => ({ type: 'model' as const, model })),
      ];

  useEffect(() => setActive(-1), [q, models.length]);

  function choose(option: Option | undefined) {
    if (!option) {
      if (!q) return;
      pushRecent(q);
      setOpen(false);
      onSubmit(q);
      return;
    }
    setOpen(false);
    inputRef.current?.blur();
    if (option.type === 'query') {
      pushRecent(option.label);
      setValue(option.label);
      onSubmit(option.label);
    } else if (option.type === 'brand') {
      setValue('');
      onPickBrand(option.label);
    } else {
      onPickWatch(option.model);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (i + 1) % options.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (options.length ? (i <= 0 ? options.length - 1 : i - 1) : -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && options.length > 0;
  const recentCount = q ? 0 : recent.length;

  return (
    <div className={`searchbox ${variant}`}>
      <form
        role="search"
        className="searchbox-form"
        onSubmit={(e) => {
          e.preventDefault();
          choose(active >= 0 ? options[active] : undefined);
        }}
      >
        <Search size={variant === 'hero' ? 21 : 17} strokeWidth={1.7} aria-hidden />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Search watches"
          placeholder={variant === 'hero' ? `Search ${totalCatalog ? totalCatalog.toLocaleString('en') + ' ' : ''}watches by model or reference` : 'Search watches…'}
          value={value}
          autoFocus={autoFocus}
          maxLength={200}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setRecent(readRecent());
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {value && (
          <button type="button" className="searchbox-clear" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={() => { setValue(''); inputRef.current?.focus(); }}>
            <X size={16} />
          </button>
        )}
        {variant === 'hero' && (
          <button className="searchbox-submit" aria-label="Search" disabled={!q}>
            <ArrowRight size={20} />
          </button>
        )}
      </form>

      {showList && (
        <ul className="suggestions" role="listbox" id={listId} aria-label="Search suggestions">
          {!q && <li className="suggestions-label" role="presentation">{recent.length ? 'Recent and popular' : 'Popular searches'}</li>}
          {options.map((o, i) => {
            const label = !q && o.type === 'model' && (i === 0 || options[i - 1].type !== 'model') ? <li key="tracked-label" className="suggestions-label" role="presentation">Most tracked watches</li> : null;
            const common = {
              id: `${listId}-${i}`,
              role: 'option' as const,
              'aria-selected': i === active,
              className: `suggestion ${o.type}${i === active ? ' active' : ''}`,
              onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
              onMouseEnter: () => setActive(i),
              onClick: () => choose(o),
            };
            if (o.type === 'query')
              return (
                <li key={`q-${o.label}-${i}`} {...common}>
                  <span className="suggestion-icon">{!q && i < recentCount ? <Clock size={15} /> : q ? <Search size={15} /> : <TrendingUp size={15} />}</span>
                  <span className="suggestion-text">{q ? <>Search for “<strong>{o.label}</strong>”</> : o.label}</span>
                  <ArrowRight size={14} className="suggestion-go" />
                </li>
              );
            if (o.type === 'brand')
              return (
                <li key={`b-${o.label}`} {...common}>
                  <span className="suggestion-icon"><Tag size={15} /></span>
                  <span className="suggestion-text"><Highlight text={o.label} query={q} /><small>Brand · {o.count.toLocaleString('en')} references</small></span>
                  <ArrowRight size={14} className="suggestion-go" />
                </li>
              );
            return (
              <Fragment key={o.model.id}>
                {label}
                <li {...common}>
                  <span className="suggestion-thumb"><WatchPhoto model={o.model} credit={false} iconSize={18} /></span>
                  <span className="suggestion-text">
                    <Highlight text={`${o.model.brand} ${o.model.name}`} query={q} />
                    <small>Ref. <Highlight text={o.model.reference} query={q} />{o.model.variants && o.model.variants > 1 ? ` · ${o.model.variants} variants` : ''}</small>
                  </span>
                  {o.model.market && <span className="suggestion-price">{money(o.model.market.price, o.model.market.currency)}</span>}
                  <ArrowRight size={14} className="suggestion-go" />
                </li>
              </Fragment>
            );
          })}
          {q && loading && !models.length && <li className="suggestions-label" role="presentation">Finding watches…</li>}
          {q && !loading && q.length >= 2 && !models.length && <li className="suggestions-label" role="presentation">No matching references — press Enter to search anyway</li>}
        </ul>
      )}
    </div>
  );
}
