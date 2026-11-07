import { inRegion, type Observation } from '../lib/market';

export type View = 'home' | 'watch' | 'collection' | 'records' | 'sources' | 'brands' | 'clip' | 'import';
export type Route = { view: View; id?: string; q?: string; brand?: string };
export type Prefs = { region: string; currency: string; basis: string; method: string; period: string; condition: string; seller: string };
export type ModalKind = '' | 'owned' | 'observation' | 'source' | 'model' | 'about';
export type BrandFacet = { brand: string; count: number };
export type Me = { user: { name: string | null; email: string; displayName: string } | null; signOutPath?: string; signInPath?: string };
export type LiveListing = Observation & { title: string; collectedAt: string; match: 'exact' | 'similar'; image?: string; listedAt?: string };
export type SourceStatus = { id: string; name: string; status: 'ok' | 'error' | 'credentials_required' | 'blocked'; count: number; message?: string; searchUrl?: string };
export type LiveResult = { modelId: string; fetchedAt: string; listings: LiveListing[]; sources: SourceStatus[]; threads?: { title: string; url: string; date: string; source: string }[] };

export const defaultPrefs: Prefs = { region: 'Global', currency: 'EUR', basis: 'asking', method: 'median', period: '365', condition: 'all', seller: 'all' };
export const statuses: Record<string, string> = { asking: 'Asking price', 'confirmed-sale': 'Confirmed sale', 'sold-asking': 'Sold · last ask' };
export const regions: [string, string][] = [['Global', 'Global'], ['EU', 'European Union'], ['US', 'United States'], ['Asia', 'Asia'], ['FI', 'Finland'], ['GB', 'United Kingdom'], ['CH', 'Switzerland']];
export const periods: [string, string][] = [['30', '1M'], ['90', '3M'], ['180', '6M'], ['365', '1Y'], ['36500', 'All']];
export const popularBrands = ['Rolex', 'Omega', 'Tudor', 'Cartier', 'Patek Philippe', 'Audemars Piguet', 'Seiko', 'Grand Seiko', 'TAG Heuer', 'Breitling', 'IWC', 'Longines'];
export const popularSearches = ['Rolex Submariner', 'Omega Speedmaster', 'Tudor Black Bay', 'Rolex Datejust 36', 'Cartier Santos', 'Seiko Prospex'];

export const today = () => new Date().toISOString().slice(0, 10);
export function periodStart(period: string) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - Number(period));
  return d.toISOString().slice(0, 10);
}

/** Applies the shared price filters. Region can be skipped for per-region breakdowns. */
export function matchesPrefs(o: Observation, p: Prefs, { region = true, period = true } = {}) {
  return (
    (!region || inRegion(o.country, p.region)) &&
    o.currency === p.currency &&
    (p.basis === 'all' || o.status === p.basis) &&
    (p.condition === 'all' || o.condition === p.condition) &&
    (p.seller === 'all' || o.sellerType === p.seller) &&
    (!period || o.observedAt >= periodStart(p.period))
  );
}

export function parseRoute(search: string): Route {
  const p = new URLSearchParams(search);
  const watch = p.get('watch');
  if (watch) return { view: 'watch', id: watch };
  const view = p.get('view') as View | null;
  if (view && ['collection', 'records', 'sources', 'brands', 'clip', 'import'].includes(view)) return { view };
  return { view: 'home', q: p.get('q') || '', brand: p.get('brand') || '' };
}

export function routeUrl(r: Route) {
  const p = new URLSearchParams();
  if (r.view === 'watch' && r.id) p.set('watch', r.id);
  else if (r.view !== 'home') p.set('view', r.view);
  else {
    if (r.q) p.set('q', r.q);
    if (r.brand) p.set('brand', r.brand);
  }
  const s = p.toString();
  return s ? `/?${s}` : '/';
}
