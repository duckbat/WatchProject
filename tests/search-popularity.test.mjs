import assert from 'node:assert/strict';
import { lib } from './helpers/lib.mjs';

const { searchCatalog, mostTracked, allModels, variantsOf, variantLabel, dialOf } = await lib('catalog');

// Grouping: one result per base reference; the 126200 Datejust's dials collapse into one card with a variant count.
const dj = allModels.filter((m) => m.reference.startsWith('126200-'));
assert.ok(dj.length > 10);
const grouped = searchCatalog({ q: '126200', pageSize: 50 }).items;
assert.equal(grouped.length, 1);
assert.equal(grouped[0].variants, dj.length);
assert.equal(searchCatalog({ q: '126200', pageSize: 50, group: false }).items.length, dj.length);
// A specific variant query shows that variant as the card.
assert.equal(searchCatalog({ q: '126200-0006' }).items[0].reference, '126200-0006');

// Order: most market data first, then fewer, then none; an exact reference stays on top.
const subs = searchCatalog({ q: 'rolex submariner', pageSize: 50 }).items;
const quiet = subs.at(-1), mid = subs.at(-2);
const ranked = searchCatalog({ q: 'rolex submariner', pageSize: 50, popularity: new Map([[quiet.id, 40], [mid.id, 5]]) }).items;
assert.deepEqual(ranked.slice(0, 2).map((m) => [m.id, m.priced]), [[quiet.id, 40], [mid.id, 5]]);
assert.equal(ranked[2].priced, undefined);
const variant = allModels.find((m) => m.reference === '116610LV-0002' || m.reference === '116610lv-0002');
const exact = searchCatalog({ q: '124060', popularity: new Map([[variant.id, 500]]) }).items;
assert.ok(exact[0].reference.startsWith('124060')); // 500 prices elsewhere cannot outrank the exact reference.

// Brand browsing without a query also puts watches with data first.
const tudor = allModels.filter((m) => m.brand === 'Tudor' && m.id.startsWith('ref-'));
assert.equal(searchCatalog({ brand: 'Tudor', pageSize: 5, popularity: new Map([[tudor.at(-1).id, 3]]) }).items[0].id, tudor.at(-1).id);

// Most tracked: one entry per base reference, highest counts first, unknown IDs ignored.
const sub = allModels.filter((m) => m.reference === '124060' || m.reference === '124060-0001');
const top = mostTracked(new Map([[sub[0].id, 36], [sub[1].id, 36], [tudor[0].id, 50], ['missing', 99]]), 5);
assert.deepEqual(top.map((m) => m.priced), [50, 36]);

// Variants: starter duplicates are not listed; labels say what differs; dial colors come from the catalog name.
assert.ok(variantsOf(sub.find((m) => m.reference === '124060')).every((m) => m.id.startsWith('ref-')));
const v6 = dj.find((m) => m.reference === '126200-0006');
assert.equal(variantLabel(v6, variantsOf(v6)), 'Domed · Blue · Oyster');
assert.equal(dialOf(v6), 'blue');
console.log(`Search checks passed: ${dj.length} Datejust 36 variants grouped, data-first order, exact reference on top, variant labels.`);

// Dial matching for the dial-specific price.
const { namesDial } = await lib('collectors/matching/dial');
assert.ok(namesDial('Rolex Datejust 36 126200 blue dial', v6.name));
assert.ok(namesDial('Rolex 126200 sininen taulu', v6.name)); // Finnish "blue dial"
assert.ok(!namesDial('Rolex 126200 full set 2023', v6.name)); // dial not stated
assert.ok(!namesDial('Rolex 126200 green dial', v6.name));
assert.ok(!namesDial('Rolex 126200 black dial blue strap', v6.name));
console.log('Dial checks passed.');

// Card prices: the all-dials 1-year median in EUR, cross-posts once, outliers out, old prices ignored.
const { summarizeMarkets } = await lib('market-archive/summary');
const now = Date.parse('2026-11-08T12:00:00Z');
const row = (price, extra = {}) => ({ modelId: 'm', price, currency: 'EUR', status: 'asking', match: 'reference', sourceId: 'watchrecon', observedAt: '2026-11-01', listedAt: '2026-10-20', title: `Rolex 126200 ad ${price}`, ...extra });
const fx = { date: '2026-11-07', rates: { EUR: 1, SEK: 11 } };
const s = summarizeMarkets([row(9000), row(9200), row(8800, { currency: 'SEK', price: 96800 }), row(9100, { match: 'similar' }), row(90000), row(9000, { listedAt: '2024-01-01' }), row(9050)], fx, now).get('m');
assert.equal(s.priced, 6); // the archived "similar" (other-dial) listing counts toward the price, not toward ranking
assert.equal(s.count, 5); // 2024 price too old, 90 000 outlier dropped
assert.equal(s.priceEur, 9050);
console.log('Card price summary checks passed.');
