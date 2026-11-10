import assert from 'node:assert/strict';
import { lib } from './helpers/lib.mjs';
const { planArchiveWrites, assembleRows, listingPrefix, offerPrefix, archiveId, isStorageV2 } = await lib('market-archive/storage');
const { mergeListings } = await lib('market-archive/listings');

const model = { id: 'sub', brand: 'Rolex', reference: '124060-0001', name: 'Submariner No-Date 41 / Black', family: 'Submariner' };
const base = { modelId: 'sub', country: 'FI', currency: 'EUR', status: 'asking', condition: 'used', sellerType: 'private', contents: 'unknown' };
const listing = (n, title, extra = {}) => ({ ...base, sourceId: 'tori', url: `https://www.tori.fi/x/${n}`, title, price: 9000 + n, observedAt: '2026-11-08', collectedAt: '2026-11-08T10:00:00Z', match: 'similar', ...extra });
const ours = listing(1, 'Rolex Submariner 124060 2023', { match: 'reference' });
const otherDial = listing(2, 'Rolex 124060 Submariner Hulk green dial'); // names the base reference: kept for "All dials"
const otherModel = listing(3, 'Rolex Datejust 126200 blue');            // another model: loaded on request
const offer = { ...base, sourceId: 'laatukellot', url: 'https://www.laatukellot.fi/rolex/9', title: 'Rolex Submariner 124060', price: 11000, observedAt: '2026-11-08', collectedAt: '2026-11-08T10:00:00Z', match: 'reference', condition: 'new', sellerType: 'dealer', history: [{ date: '2026-11-08', price: 11000 }] };
const archive = (listings, retailOffers, fetchedAt) => ({ modelId: 'sub', matchingVersion: 8, collectorVersion: 2, fetchedAt, partial: false, listings, retailOffers, sources: [], threads: [], note: '' });

// First write: every listing and offer becomes a row; the page gets this reference's listings only.
const t1 = '2026-11-08T10:00:00.000Z';
const first = mergeListings([], [ours, otherDial, otherModel], t1);
let w = planArchiveWrites('__market__', model, archive(first, [{ ...offer, archived: false }], t1), new Map());
const aid = archiveId('__market__', 'sub');
assert(isStorageV2(w.meta));
assert.equal(w.upserts.length, 4);
assert.deepEqual(w.upserts.map((r) => r.kind).sort(), ['market-listing', 'market-listing', 'market-offer', 'market-similar']);
assert(w.upserts.every((r) => r.id.startsWith(listingPrefix(aid)) || r.id.startsWith(offerPrefix(aid))));
assert.deepEqual(w.listings.map((l) => l.url).sort(), [ours.url, otherDial.url]);
assert.equal(w.meta.otherSimilar, 1);
assert.equal(JSON.stringify(w.meta).includes('Datejust'), false, 'the archive row holds no listings');
const stored = new Map(w.upserts.map((r) => [r.id, r]));

// The same listings collected again later the same day: nothing is rewritten except the archive row.
const t2 = '2026-11-08T16:00:00.000Z';
const again = mergeListings(assembleRows([...stored.values()].filter((r) => r.kind !== 'market-offer'), w.meta.live, w.meta.fetchedAt), [{ ...ours, collectedAt: t2 }, { ...otherDial, collectedAt: t2 }, { ...otherModel, collectedAt: t2 }], t2);
w = planArchiveWrites('__market__', model, archive(again, [{ ...offer, archived: false }], t2), stored);
assert.equal(w.upserts.length, 0, 'unchanged listings are not rewritten');
assert.equal(w.deletes.length, 0);

// A price cut and a listing that disappeared: only those two rows change; nothing is deleted.
const t3 = '2026-11-09T10:00:00.000Z';
const live2 = assembleRows([...stored.values()].filter((r) => r.kind !== 'market-offer'), w.meta.live, t2);
const next = mergeListings(live2, [{ ...ours, price: 8800, observedAt: '2026-11-09' }, otherModel], t3);
w = planArchiveWrites('__market__', model, archive(next, [{ ...offer, archived: false }], t3), stored);
assert.deepEqual(w.upserts.map((r) => r.id).sort(), [listingPrefix(aid) + ours.url, listingPrefix(aid) + otherDial.url].sort());
assert.equal(w.deletes.length, 0);
for (const r of w.upserts) stored.set(r.id, r);

// Reading back: live listings take the last collection's time; the archived one keeps when it was last seen.
const rows = assembleRows([...stored.values()].filter((r) => r.kind === 'market-listing'), w.meta.live, t3);
const byUrl = Object.fromEntries(rows.map((l) => [l.url, l]));
assert.deepEqual([byUrl[ours.url].archived, byUrl[ours.url].price, byUrl[ours.url].observedAt, byUrl[ours.url].lastSeenAt], [false, 8800, '2026-11-09', t3]);
assert.deepEqual(byUrl[ours.url].priceChanges, [{ date: '2026-11-08', price: 9001 }]);
assert.deepEqual([byUrl[otherDial.url].archived, byUrl[otherDial.url].lastSeenAt], [true, t2]);

// A re-keyed listing (URL migration) leaves no duplicate: the old row is deleted, its data lives on under the new key.
const renamed = new Map(stored);
renamed.set(listingPrefix(aid) + 'https://old.example/1', { id: listingPrefix(aid) + 'https://old.example/1', kind: 'market-listing', payload: '{}' });
assert.deepEqual(planArchiveWrites('__market__', model, archive(next, [{ ...offer, archived: false }], t3), renamed).deletes, [listingPrefix(aid) + 'https://old.example/1']);
console.log('Storage checks passed: one row per listing, this reference vs other models, unchanged rows not rewritten, nothing lost.');
