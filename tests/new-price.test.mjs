import assert from 'node:assert/strict';
import { lib } from './helpers/lib.mjs';

// Shop offers keep one price per day, so the new-price graph shows a shop's price changes over time.
const { mergeOffers } = await lib('market-archive/listings');
const offer = (price, extra = {}) => ({ modelId: 'm', sourceId: 'laatukellot', country: 'UNKNOWN', currency: 'EUR', price, status: 'asking', observedAt: '2026-11-01', condition: 'new', sellerType: 'dealer', contents: 'unknown', url: 'https://www.laatukellot.fi/rolex/1', title: 'Rolex 124060', collectedAt: '2026-11-01', match: 'exact', ...extra });
let archive = mergeOffers([], [offer(13000)], '2026-11-01T10:00:00Z');
assert.deepEqual(archive[0].history, [{ date: '2026-11-01', price: 13000 }]);
archive = mergeOffers(archive, [offer(12900)], '2026-11-01T18:00:00Z'); // same day: latest price wins
assert.deepEqual(archive[0].history, [{ date: '2026-11-01', price: 12900 }]);
archive = mergeOffers(archive, [offer(12500, { observedAt: '2026-11-08' })], '2026-11-08T10:00:00Z');
assert.deepEqual(archive[0].history.map((h) => h.price), [12900, 12500]);
archive = mergeOffers(archive, [], '2026-11-09T10:00:00Z'); // gone from the shop: archived, history kept
assert.equal(archive[0].archived, true);
assert.equal(archive[0].history.length, 2);
// An offer archived before history existed starts from its last observed price.
const legacy = mergeOffers([{ ...offer(13100), archived: true }], [offer(13200, { observedAt: '2026-11-08' })], '2026-11-08T10:00:00Z');
assert.deepEqual(legacy[0].history, [{ date: '2026-11-01', price: 13100 }, { date: '2026-11-08', price: 13200 }]);
console.log('Offer history checks passed.');

// eBay new offers: production keys only; new, business-seller listings across the regional eBay sites.
const { collectEbayNewOffers, NEW_PRICE_MARKETPLACES } = await lib('collectors');
const model = { id: 'omega', brand: 'Omega', name: 'Speedmaster Moonwatch', reference: '310.30.42.50.01.001' };
assert.equal((await collectEbayNewOffers(model, {})).sources[0].status, 'credentials_required');
assert.equal((await collectEbayNewOffers(model, { EBAY_CLIENT_ID: 'a', EBAY_CLIENT_SECRET: 'b', EBAY_ENVIRONMENT: 'sandbox' })).listings.length, 0);
const item = (n, country, seller, extra = {}) => ({ title: `Omega Speedmaster Moonwatch 310.30.42.50.01.001 #${n}`, itemWebUrl: `https://www.ebay.com/itm/${n}`, price: { value: '7000', currency: 'USD' }, itemLocation: { country }, conditionId: '1000', seller: { sellerAccountType: seller }, ...extra });
const realFetch = globalThis.fetch;
const asked = [];
globalThis.fetch = async (url, init) => {
  if (String(url).includes('/oauth2/token')) return new Response(JSON.stringify({ access_token: 't' }));
  const site = init.headers['X-EBAY-C-MARKETPLACE-ID'];
  asked.push([site, new URL(String(url)).searchParams.get('filter')]);
  const bySite = { EBAY_US: [item(1, 'US', 'BUSINESS'), item(2, 'US', 'INDIVIDUAL')], EBAY_HK: [{ ...item(3, 'HK', 'BUSINESS'), itemWebUrl: 'https://www.ebay.com.hk/itm/3', price: { value: '55000', currency: 'HKD' } }], EBAY_DE: [item(1, 'US', 'BUSINESS'), { ...item(4, 'DE', 'BUSINESS'), conditionId: '3000' }] };
  return new Response(JSON.stringify({ itemSummaries: bySite[site] || [] }));
};
try {
  const r = await collectEbayNewOffers(model, { EBAY_CLIENT_ID: 'a', EBAY_CLIENT_SECRET: 'b' });
  assert.deepEqual(asked.map(([s]) => s).sort(), [...NEW_PRICE_MARKETPLACES].sort());
  assert.ok(asked.every(([, f]) => f === 'conditionIds:{1000},buyingOptions:{FIXED_PRICE}'));
  assert.deepEqual(r.listings.map((l) => [l.country, l.currency]).sort(), [['HK', 'HKD'], ['US', 'USD']]); // private seller, used item and duplicate dropped
  assert.equal(r.sources[0].status, 'ok');
} finally {
  globalThis.fetch = realFetch;
}
console.log('eBay new-offer checks passed.');
