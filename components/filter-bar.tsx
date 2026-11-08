'use client';
import { ArrowLeftRight, SlidersHorizontal, Tag } from 'lucide-react';
import { statuses, type Prefs } from './shared';

type Props = {
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  brand?: string;
  brands?: string[];
  onBrand?: (brand: string) => void;
  extended?: boolean;
};

/** Compact filters that sit directly under the search field instead of a sidebar. */
export default function FilterBar({ prefs, onPrefs, brand, brands, onBrand, extended }: Props) {
  const set = (k: keyof Prefs) => (e: React.ChangeEvent<HTMLSelectElement>) => onPrefs({ ...prefs, [k]: e.target.value });
  const changed = (['basis', 'method', 'condition', 'seller'] as const).some(
    (k) => prefs[k] !== ({ region: 'Global', currency: 'EUR', basis: 'all', method: 'median', condition: 'all', seller: 'all' } as Prefs)[k],
  );
  return (
    <div className="filter-bar" role="group" aria-label="Filters">
      <SlidersHorizontal size={15} className="filter-bar-icon" aria-hidden />
      {onBrand && brands && (
        <label className={`filter-pill${brand ? ' on' : ''}`}>
          <Tag size={13} aria-hidden />
          <select aria-label="Brand" value={brand || ''} onChange={(e) => onBrand(e.target.value)}>
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
      )}
      <label className={`filter-pill${prefs.basis !== 'all' ? ' on' : ''}`}>
        <select aria-label="Price type" value={prefs.basis} onChange={set('basis')}>
          {Object.entries(statuses).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
          <option value="all">All price types</option>
        </select>
      </label>
      <label className={`filter-pill${prefs.method !== 'median' ? ' on' : ''}`}>
        <select aria-label="Statistic" value={prefs.method} onChange={set('method')}>
          <option value="median">Median</option>
          <option value="average">Average</option>
        </select>
      </label>
      <label className={`filter-pill${prefs.convert === 'off' ? ' on' : ''}`} title="Convert prices in other currencies with ECB reference rates">
        <ArrowLeftRight size={13} aria-hidden />
        <select aria-label="Other currencies" value={prefs.convert || 'on'} onChange={set('convert')}>
          <option value="on">Convert currencies</option>
          <option value="off">Only {prefs.currency} prices</option>
        </select>
      </label>
      {extended && (
        <>
          <label className={`filter-pill${prefs.condition !== 'all' ? ' on' : ''}`}>
            <select aria-label="Condition" value={prefs.condition} onChange={set('condition')}>
              <option value="all">Any condition</option>
              <option value="used">Pre-owned</option>
              <option value="new">New / unworn</option>
            </select>
          </label>
          <label className={`filter-pill${prefs.seller !== 'all' ? ' on' : ''}`}>
            <select aria-label="Seller type" value={prefs.seller} onChange={set('seller')}>
              <option value="all">Any seller</option>
              <option value="private">Private seller</option>
              <option value="dealer">Dealer</option>
            </select>
          </label>
        </>
      )}
      {(changed || brand) && (
        <button
          type="button"
          className="filter-reset"
          onClick={() => {
            onPrefs({ ...prefs, basis: 'all', method: 'median', condition: 'all', seller: 'all' });
            onBrand?.('');
          }}
        >
          Reset
        </button>
      )}
    </div>
  );
}
