'use client';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, BookmarkPlus, ClipboardPaste, ChevronDown, Database, Download, Globe2, Layers3, ListChecks, LogIn, LogOut, Plus, Watch } from 'lucide-react';
import { currencies, type Model } from '../lib/market';
import SearchBox from './search-box';
import { regions, type BrandFacet, type Me, type ModalKind, type Prefs, type Route } from './shared';

type Props = {
  route: Route;
  me: Me | null;
  brands: BrandFacet[];
  ownedCount: number;
  observationCount: number;
  onNavigate: (r: Route) => void;
  onModal: (k: ModalKind) => void;
  onExport: () => void;
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
};

export default function SiteHeader({ route, me, brands, ownedCount, observationCount, onNavigate, onModal, onExport, prefs, onPrefs }: Props) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menu]);

  const user = me?.user;
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();
  const go = (r: Route) => {
    setMenu(false);
    onNavigate(r);
  };
  const act = (fn: () => void) => () => {
    setMenu(false);
    fn();
  };
  const nav: [string, Route, boolean][] = [
    ['Watches', { view: 'home' }, route.view === 'home' || route.view === 'watch'],
    ['Brands', { view: 'brands' }, route.view === 'brands'],
  ];

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a
          className="logo"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go({ view: 'home' });
          }}
        >
          <Watch size={22} strokeWidth={1.5} />
          <span>WatchLedger<span className="logo-dot">.</span></span>
        </a>

        <nav className="main-nav" aria-label="Main">
          {nav.map(([label, r, active]) => (
            <button key={label} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} onClick={() => go(r)}>
              {label}
            </button>
          ))}
          <button onClick={() => onModal('about')}>How prices work</button>
        </nav>

        {route.view !== 'home' && (
          <div className="header-search">
            <SearchBox
              variant="compact"
              brands={brands}
              initial=""
              onSubmit={(q) => go({ view: 'home', q })}
              onPickBrand={(brand) => go({ view: 'home', brand })}
              onPickWatch={(m: Model) => go({ view: 'watch', id: m.id })}
            />
          </div>
        )}

        <label className="currency-picker region-picker" title="Seller region for all prices">
          <Globe2 size={14} className="currency-symbol" aria-hidden />
          <select aria-label="Region" value={prefs.region} onChange={(e) => onPrefs({ ...prefs, region: e.target.value })}>
            {regions.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>

        <label className="currency-picker" title="Currency for all prices">
          <span className="currency-symbol" aria-hidden>{new Intl.NumberFormat('en', { style: 'currency', currency: prefs.currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')?.value}</span>
          <select aria-label="Currency" value={prefs.currency} onChange={(e) => onPrefs({ ...prefs, currency: e.target.value })}>
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>

        <div className="user-menu" ref={menuRef}>
          <button className="profile-button" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            <span className="avatar">{initial}</span>
            <span className="profile-label">My watches{ownedCount > 0 && <span className="nav-count">{ownedCount}</span>}</span>
            <ChevronDown size={14} />
          </button>
          {menu && (
            <div className="profile-menu" role="menu">
              {user ? (
                <div className="profile-id">
                  <span className="avatar large">{initial}</span>
                  <div>
                    <strong>{user.name || user.displayName}</strong>
                    <small>{user.email}</small>
                  </div>
                </div>
              ) : (
                <div className="profile-id">
                  <span className="avatar large">?</span>
                  <div>
                    <strong>Not signed in</strong>
                    <small>Sign in to save watches and prices</small>
                  </div>
                </div>
              )}
              <button role="menuitem" onClick={() => go({ view: 'collection' })}>
                <Layers3 size={16} />My watches<span className="nav-count">{ownedCount}</span>
              </button>
              <button role="menuitem" onClick={() => go({ view: 'records' })}>
                <ListChecks size={16} />Price records<span className="nav-count">{observationCount}</span>
              </button>
              <button role="menuitem" onClick={() => go({ view: 'sources' })}>
                <Database size={16} />Marketplace sources
              </button>
              <button role="menuitem" onClick={() => go({ view: 'clip' })}>
                <BookmarkPlus size={16} />Save from any website
              </button>
              <button role="menuitem" onClick={() => go({ view: 'import' })}>
                <ClipboardPaste size={16} />Import group posts
              </button>
              <hr />
              <button role="menuitem" onClick={act(() => onModal('owned'))}>
                <Plus size={16} />Add a watch I own
              </button>
              <button role="menuitem" onClick={act(onExport)}>
                <Download size={16} />Export my data
              </button>
              <button role="menuitem" onClick={act(() => onModal('about'))}>
                <BookOpen size={16} />About the data
              </button>
              <hr />
              {user && me?.signOutPath ? (
                <a role="menuitem" href={me.signOutPath} target="_top">
                  <LogOut size={16} />Sign out
                </a>
              ) : (
                <a role="menuitem" href={me?.signInPath || '/signin-with-chatgpt?return_to=%2F'} target="_top">
                  <LogIn size={16} />Sign in
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
