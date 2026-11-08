import assert from 'node:assert/strict';
import { lib } from './helpers/lib.mjs';

const { searchCatalog, mostTracked, allModels } = await lib('catalog');

const subs = searchCatalog({ q: 'rolex submariner', pageSize: 50 }).items;
const quiet = subs.at(-1), popular = new Map([[quiet.id, 40]]);
assert.notEqual(subs[0].id, quiet.id);
const ranked = searchCatalog({ q: 'rolex submariner', pageSize: 50, popularity: popular }).items;
assert.equal(ranked[0].id, quiet.id); // Among equal model-line matches, the watch with the most market data leads.
assert.equal(ranked[0].priced, 40);
assert.equal(ranked[1].priced, undefined);

// Data never lifts a watch above an exact reference match.
const variant = allModels.find((m) => m.reference === '124060-0001');
const exact = searchCatalog({ q: '124060', popularity: new Map([[variant.id, 500]]) }).items;
assert.deepEqual(exact.slice(0, 2).map((m) => m.reference), ['124060', '124060-0001']); // 500 prices cannot outrank the exact reference.

// Browsing a brand without a query puts tracked watches first.
const tudor = allModels.filter((m) => m.brand === 'Tudor');
const browse = searchCatalog({ brand: 'Tudor', pageSize: 5, popularity: new Map([[tudor.at(-1).id, 3]]) }).items;
assert.equal(browse[0].id, tudor.at(-1).id);
assert.equal(searchCatalog({ brand: 'Tudor', pageSize: 5 }).items[0].id, tudor[0].id);

// Most tracked: highest counts first, one entry per base reference, unknown IDs ignored.
const sub = allModels.filter((m) => m.reference === '124060' || m.reference === '124060-0001');
assert.equal(sub.length, 2);
const top = mostTracked(new Map([[sub[0].id, 36], [sub[1].id, 36], [tudor[0].id, 50], ['missing', 99]]), 5);
assert.deepEqual(top.map((m) => m.priced), [50, 36]);
assert.equal(top[1].reference.split('-')[0], '124060');
console.log('Search popularity checks passed: data orders equal matches, exact references stay first, brand browsing, most-tracked dedupe.');
