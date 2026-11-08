import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lib } from './helpers/lib.mjs';

const { parseKellotux, collectKellotux } = await lib('collectors/services/kellotux');
const { parseLaatukellot } = await lib('collectors/services/shops/laatukellot');
const { parseKeskisenKello } = await lib('collectors/services/shops/keskisenkello');
const { collectShops } = await lib('collectors/services/shops');
const { parseHuutoSale, collectHuuto } = await lib('collectors/services/huuto');
const { classifyIdentity } = await lib('collectors/matching/structured');
const { exactMatch, referenceMatch } = await lib('collectors/matching/classify');
const { mergeListings, reclassifyListings } = await lib('market-archive/listings');
const fixture = async name => JSON.parse(await readFile(`tests/fixtures/${name}.json`, 'utf8'));
const now = new Date('2026-11-08T19:00:00Z');
const black = { id: 'black', brand: 'Rolex', name: 'Datejust 36 / Black / Jubilee', reference: '126200-0007', size: '36 mm' };
const silver = { ...black, id: 'silver', reference: '126200-0001', name: 'Datejust 36 / Silver / Jubilee' };
const identity = { brand: 'Rolex', reference: '126200', dial: 'black', sizeMm: 36 };
assert.equal(classifyIdentity('Rolex Datejust', black, identity), 'reference');
assert.equal(classifyIdentity('Rolex Datejust', silver, identity), 'similar');
assert.equal(classifyIdentity('Rolex Datejust', black, { ...identity, reference: '126234' }), null);
assert.equal(classifyIdentity('Rolex Datejust', black, { ...identity, sizeMm: 41 }), 'similar');
assert.equal(classifyIdentity('Rolex Datejust', black, { ...identity, reference: '126200-0001' }), 'similar');
assert.equal(classifyIdentity('Omega Datejust', black, { ...identity, brand: 'Omega' }), null);
assert.equal(exactMatch('Rolex Datejust Ref. 126300', black, 'Rolex Ref.126200-0007'), false);
assert.equal(referenceMatch('Rolex Datejust Ref.126200-0001', black), false);
assert.equal(exactMatch('Rolex Datejust Ref.126200-0007.', black), true);
assert.equal(exactMatch('Rolex Datejust Ref.M126200-0007', { ...black, reference: '126200', name: 'Datejust 36' }), true);
assert.equal(exactMatch('Rolex Datejust Ref.126200-0007', black, 'Valkoisella taululla ja roomalaisilla indekseillä'), false);
assert.equal(exactMatch('Rolex Datejust Ref.126200-0007', black, 'Mustalla taululla ja sinisellä rannekkeella'), true);

const kellotux = await fixture('kellotux-126200');
const used = parseKellotux(kellotux, black, now);
const listing = used.find(l => l.url.endsWith('uyucxbz80capbez'));
assert.equal(listing.price, 8500);
assert.equal(listing.url, 'https://kellotux.com/listing/uyucxbz80capbez');
assert.equal(listing.currency, 'EUR');
assert.equal(listing.status, 'asking');
assert.equal(parseKellotux({ items: [{ ...kellotux.items[0], country: 'FI' }] }, black, now)[0].country, 'FI');
assert.equal(listing.match, 'reference');
assert.equal(listing.contents, 'full-set');
assert.equal(listing.canonicalUrl, 'https://www.kiipperi.fi/tuote/rolex-oyster-perpetual-datejust-36-126200/');
assert.equal(reclassifyListings([listing], silver)[0].match, 'similar');
const item = kellotux.items.find(x => x.id === 'uyucxbz80capbez');
for (const change of [{ deleted: true }, { listing_type: 'buy' }, { listing_type: 'collection' }, { expires_at: '2020-01-01' }, { reference_number: '126234' }, { price: 0 }, { status: 'withdrawn' }]) assert.equal(parseKellotux({ items: [{ ...item, ...change }] }, black, now).length, 0);
const sold = parseKellotux({ items: [{ ...item, status: 'sold', sold_on_site: true, sold_price: 8200 }] }, black, now)[0];
assert.equal(sold.status, 'confirmed-sale');
assert.equal(sold.price, 8200);
assert.equal(sold.listedAt, undefined); // No sale date is published; do not substitute the original listing date.
assert.equal(sold.observedAt, '2026-11-08');
assert.equal(parseKellotux({ items: [{ ...item, status: 'sold', sold_price: 0 }] }, black, now)[0].status, 'sold-asking');
assert.equal(parseKellotux({ items: [{ ...item, model: 'Datejust bought new 2020 and sold in 2022' }] }, black, now)[0].status, 'asking');
assert.equal(mergeListings([], [listing, { ...listing, url: 'https://kellotux.com/listing/abcdefghijklmno' }]).length, 1);
assert.equal(mergeListings([listing], [])[0].status, 'asking');
const legacy = { ...listing, url: 'https://kellotux.fi/listing/uyucxbz80capbez', canonicalUrl: undefined, firstSeenAt: '2026-11-01T12:00:00Z' };
const refreshed = mergeListings([legacy], [{ ...listing, canonicalUrl: undefined, price: 8400 }]);
assert.equal(refreshed.length, 1);
assert.equal(refreshed[0].url, listing.url);
assert.equal(refreshed[0].price, 8400);
assert.equal(refreshed[0].firstSeenAt, legacy.firstSeenAt);
assert.equal(mergeListings([legacy], [])[0].url, listing.url);

const tudor = { id: 'tudor', brand: 'Tudor', name: 'Black Bay Fifty-Eight', reference: '79030N', size: '39 mm' };
const laatu = await fixture('laatukellot-79030n');
const shop = parseLaatukellot(laatu, tudor, now);
assert.equal(shop.retailOffers.length, 1);
assert.equal(shop.retailOffers[0].price, 4329); // Current shop price, not the RRP field or num_sold.
assert.equal(shop.retailOffers[0].condition, 'new');
assert.equal(shop.listings.length, 4);
assert.ok(shop.listings.every(l => l.condition === 'used' && l.status === 'asking'));
assert.ok(laatu.products.some(p => p.type === 'used_watch' && p.badges.includes('new'))); // Newly listed is not new condition.
assert.equal(parseLaatukellot({ products: [{ ...laatu.products[1], available: 0, stock_status: { num_sold: 12 } }] }, tudor, now).retailOffers.length, 0);
assert.equal(parseLaatukellot({ products: [{ ...laatu.products[1], url: 'https://evil.example/watch/1' }] }, tudor, now).retailOffers.length, 0);
assert.equal(parseLaatukellot(laatu, { ...tudor, reference: '79030N-0002' }, now).retailOffers[0].match, 'similar');

const keskinen = await fixture('keskisenkello-search');
assert.equal(parseKeskisenKello(keskinen, { id: 'spb143', brand: 'Seiko', name: 'Prospex / Grey', reference: 'SPB143J1', size: '40.5 mm' }, now).retailOffers.length, 0); // Search suggested SPB103J1 and a bracelet for a different query.
const kk = parseKeskisenKello(keskinen, { id: 'spb103', brand: 'Seiko', name: 'Prospex / Green', reference: 'SPB103J1', size: '45 mm' }, now).retailOffers;
assert.equal(kk.length, 1);
assert.equal(kk[0].price, 960);
assert.equal(kk[0].match, 'exact');
assert.equal(parseKeskisenKello({ hits: [{ ...keskinen.hits.find(p => p.brand_feed === 'Seiko'), in_stock: false }] }, { id: 'spb103', brand: 'Seiko', name: 'Prospex', reference: 'SPB103J1' }, now).retailOffers.length, 0);

const unsold = await fixture('huuto-unsold');
assert.equal(parseHuutoSale(unsold, black, now), null); // Closed listing, still quantity 1, no public sold marker.
const soldItem = { ...unsold, links: { ...unsold.links, purchases: `https://api.huuto.net/1.1/items/${unsold.id}/purchases` } };
assert.equal(parseHuutoSale(soldItem, black, now).status, 'sold-asking'); // Accepted offers can differ from the advertised price.
const auction = { ...soldItem, saleMethod: 'auction', bidderCount: 2, hasReservePrice: true, hasReservePriceExceeded: true };
assert.equal(parseHuutoSale(auction, black, now).status, 'confirmed-sale');
assert.equal(parseHuutoSale({ ...auction, hasReservePriceExceeded: false }, black, now), null);
assert.equal(parseHuutoSale({ ...auction, closingTime: '2027-01-01' }, black, now), null);
const requested = [];
const result = await collectHuuto(black, async url => { requested.push(url); return new Response(JSON.stringify(String(url).includes('/categories/') ? { items: [{ id: unsold.id, title: unsold.title }] } : soldItem)); }, now);
assert.equal(result.listings.length, 1);
assert.ok(requested.every(u => !u.endsWith('/purchases'))); // Only public item data is collected.
const shops = await collectShops(tudor, async url => String(url).includes('laatukellot') ? new Response(JSON.stringify(laatu)) : new Response('Blocked', { status: 403 }), now);
assert.equal(shops.retailOffers.length, 1);
assert.equal(shops.sources.find(s => s.id === 'keskisenkello').status, 'blocked');
const failure = await collectKellotux(black, async () => new Response('{}'), now);
assert.equal(failure.sources[0].status, 'error');
const kellotuxResult = await collectKellotux(black, async url => { assert.equal(new URL(url).hostname, 'api.kellotux.com'); return new Response(JSON.stringify(kellotux)); }, now);
assert.equal(kellotuxResult.sources[0].name, 'Kellotux.com');
assert.equal(new URL(kellotuxResult.sources[0].searchUrl).origin, 'https://kellotux.com');
console.log('Shop and used-market checks passed: exact source identity, variant conflicts, new vs used, current price vs RRP, unavailable products, canonical duplicates, explicit sold evidence and failure isolation.');
