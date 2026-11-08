'use client';
import { useEffect } from 'react';
import type { Model } from '../lib/market';

/**
 * Card prices remembered in this browser (per watch and currency), so recently viewed and favourite cards show a
 * price straight away and are only refetched once the saved one is older than PRICE_TTL_MS. A watch with no price
 * yet is remembered as null, so it is not asked for again on every visit either. Storage can be unavailable
 * (private windows, blocked site data); everything then simply fetches as before.
 */
export type CardMarket = NonNullable<Model['market']>;

const KEY = 'watchledger:card-prices';
const MAX_ENTRIES = 300;
export const PRICE_TTL_MS = 6 * 3600_000;

type Store = Record<string, { market: CardMarket | null; at: number }>;
const key = (id: string, currency: string) => `${id}|${currency}`;

function read(): Store {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    // Keep the most recently saved entries only.
    const kept = Object.entries(store).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    /* storage full or blocked: prices are fetched instead */
  }
}

/** Saved prices for these watches, and which of them are missing or older than PRICE_TTL_MS. */
export function cachedPrices(ids: string[], currency: string) {
  const store = read(), now = Date.now();
  const prices: Record<string, CardMarket | null> = {};
  const stale: string[] = [];
  for (const id of ids) {
    const saved = store[key(id, currency)];
    if (saved) prices[id] = saved.market;
    if (!saved || now - saved.at > PRICE_TTL_MS) stale.push(id);
  }
  return { prices, stale };
}

export function rememberPrices(prices: Record<string, CardMarket | null>, currency: string) {
  const store = read(), now = Date.now();
  for (const [id, market] of Object.entries(prices)) store[key(id, currency)] = { market, at: now };
  write(store);
}

/** Saves the price a watch page showed, so its card in Recently viewed shows the same price later. */
export function RememberPrice({ id, market }: { id: string; market: CardMarket }) {
  const { price, currency, count } = market;
  useEffect(() => rememberPrices({ [id]: { price, currency, count } }, currency), [id, price, currency, count]);
  return null;
}
