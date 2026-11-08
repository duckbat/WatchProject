import assert from 'node:assert/strict';
import ts from 'typescript';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('.sites-runtime/test-modules', { recursive: true });
for (const name of ['market', 'collectors', 'phillips', 'listing-archive']) {
  const source = await readFile(`lib/${name}.ts`, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'");
  await writeFile(`.sites-runtime/test-modules/${name}.mjs`, output);
}
const { phillipsResults, parsePhillipsSale } = await import('../.sites-runtime/test-modules/phillips.mjs');
const { mergeListings, listingKind, reclassifyListings } = await import('../.sites-runtime/test-modules/listing-archive.mjs');
const model = { id: 'dj', brand: 'Rolex', reference: '126200-0001', name: 'Datejust 36' };
const now = new Date('2026-11-08T12:00:00Z');
// Reduced public markup from Phillips lot 231452, fetched November 8, 2026.
const field = (k, v) => `<span>${k}</span> </div><div class="seldon-detail__value"><span>${v}</span></div>`;
const detail = field('Manufacturer', 'Rolex') + field('Reference No', '126200') + field('Model Name', 'Datejust 36 “Palm Green”') + field('Sold For', 'HK$82,550');
const card = `<li class="col-xs-6 search-result-item"><a href='/detail/rolex/231452?fromSearch=126200' data-image="https://dist.phillips.com/watch.jpg"></a><span class="sold">Sold for HK$82,550</span><p>18 March 2026 - 25 March 2026</p></li>`;
const results = phillipsResults(`<div id="search-page">${card}</div>`);
assert.equal(results.length, 1);
assert.equal(results[0].date, '2026-03-25');
assert.equal(results[0].url, 'https://www.phillips.com/detail/rolex/231452');
const sale = parsePhillipsSale(detail, results[0], model, now);
assert.equal(sale.price, 82550);
assert.equal(sale.currency, 'HKD');
assert.equal(sale.status, 'confirmed-sale');
assert.equal(sale.match, 'reference'); // base reference only: variant not stated
assert.equal(parsePhillipsSale(detail, results[0], { ...model, name: 'Datejust 36 / Silver / Jubilee' }, now).match, 'similar'); // Palm Green is not the silver dial
assert.equal(parsePhillipsSale(detail.replace('126200', '126200-0001'), results[0], model, now).match, 'exact');
assert.equal(sale.country, 'UNKNOWN'); // Auction venue is not the seller's location.
assert.equal(parsePhillipsSale(detail.replace('126200', '1262000'), results[0], model, now), null);
assert.equal(parsePhillipsSale(detail.replace('Rolex', 'Ellicott'), results[0], model, now), null);
assert.equal(parsePhillipsSale(detail.replace('Sold For', 'Estimate'), results[0], model, now), null);
assert.equal(parsePhillipsSale(detail, { ...results[0], date: '2027-01-01' }, model, now), null);
assert.equal(phillipsResults(`<div id="search-page">${card.replace('class="sold"', 'class="estimate"')}</div>`).length, 0);
assert.equal(phillipsResults(`<div id="search-page">${card.replace('/detail/rolex/231452', '//evil.example/detail/1')}</div>`).length, 0);
assert.throws(() => phillipsResults('<html>Challenge</html>'), /public search/);

const asking = { ...sale, match: 'exact', url: 'https://www.tori.fi/recommerce/forsale/item/1', status: 'asking', sourceId: 'tori' };
const initial = mergeListings([], [asking, asking], now.toISOString());
assert.equal(initial.length, 1);
const retained = mergeListings(initial, [], '2026-11-09T12:00:00Z');
assert.equal(retained[0].status, 'asking'); // Absence is never a confirmed sale.
assert.equal(retained[0].archived, true);
assert.equal(retained[0].lastSeenAt, now.toISOString());
assert.equal(initial[0].archived, false); // Merging does not mutate a previous response.
const sold = mergeListings(retained, [{ ...asking, status: 'sold-asking' }], '2026-11-10T12:00:00Z');
assert.equal(sold.length, 1);
assert.equal(sold[0].firstSeenAt, initial[0].firstSeenAt);
assert.equal(listingKind(sold[0]), 'sold-asking');
assert.equal(listingKind({ ...sale, match: 'exact' }), 'confirmed-sale');
assert.equal(listingKind(retained[0]), 'asking');
assert.equal(listingKind(initial[0]), 'live');
assert.equal(listingKind({ ...sale, match: 'similar' }), 'similar');
console.log('Auction/history checks passed: reported amounts, exact references, dates, estimates excluded, retained listings, status transitions and chart categories.');

const old={...sale,match:'exact'};
const rechecked=reclassifyListings([old,{...old,url:'https://www.phillips.com/detail/rolex/2',title:'Rolex 126200-0001 silver dial'}],{...model,name:'Datejust 36 / Silver / Jubilee'});
assert.equal(rechecked[0].match,'similar');
assert.equal(rechecked[0].price,old.price);
assert.equal(rechecked[1].match,'exact');
assert.equal(old.match,'exact');
console.log('Legacy archives are reclassified without changing prices or deleting observations.');
