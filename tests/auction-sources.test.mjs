import assert from 'node:assert/strict';
import { lib } from './helpers/lib.mjs';
import { readFile } from 'node:fs/promises';

const { parseAntiquorum, parseChristies, christiesCatalogue, collectAuctionSources, parseAuctionet } = await lib('collectors');
const { mergeListings, reclassifyListings } = await lib('market-archive/listings');
const { classifyMatch } = await lib('collectors');
const model = { id: 'op', brand: 'Rolex', reference: '124300', name: 'Oyster Perpetual / Blue' };
const now = new Date('2026-11-08T12:00:00Z');
const blueVariant = { ...model, reference: '124300-0003' };
for (const title of ['Rolex Oyster Perpetual 124300 Grön Fullset', 'Rolex Oyster Perpetual 124300 grøn 2022', 'Rolex Oyster Perpetual 124300 Svart', 'Rolex Oyster Perpetual 124300 Grå']) assert.equal(classifyMatch(title, blueVariant), 'similar');
assert.equal(classifyMatch('Rolex 124300 Blå urtavla', blueVariant), 'reference');
assert.equal(classifyMatch('Rolex Oyster Perpetual 124300-0003 Svart urtavla', blueVariant), 'similar');
// Reduced first-party public data fetched 8 November 2026.
const lot = JSON.parse(await readFile('tests/fixtures/christies-124300.json', 'utf8'));
const antique = await readFile('tests/fixtures/antiquorum-124300.html', 'utf8');
const catalogue = lots => `<script>window.chrComponents = ${JSON.stringify({ lots: { data: { lots, total_pages: 1 } } })};</script>`;
const sale = parseChristies([lot], model, now)[0];
assert.equal(sale.price, 7560); // The current bid is 6000; it is not the price realised.
assert.equal(sale.currency, 'CHF');
assert.equal(sale.status, 'confirmed-sale');
assert.equal(sale.observedAt, '2023-12-12');
assert.equal(sale.match, 'exact');
assert.equal(sale.country, 'UNKNOWN');
assert.equal(parseChristies([lot, lot], model, now).length, 1);
assert.equal(parseChristies([{ ...lot, price_realised: null }], model, now).length, 0);
for (const change of [{ is_unsold: true }, { lot_withdrawn: true }, { is_open_for_bidding: true }, { end_date: '2027-01-01' }, { price_realised: -1 }, { url: 'https://evil.example/s/lot/a/1' }, { title_primary_txt: 'Rolex Ref.1243000' }]) {
  assert.equal(parseChristies([{ ...lot, ...change }], model, now).length, 0);
}
assert.equal(parseChristies([lot], { ...model, name: 'Oyster Perpetual / Silver' }, now)[0].match, 'similar');
assert.equal(reclassifyListings([sale], { ...model, name: 'Oyster Perpetual / Silver' })[0].match, 'similar');
assert.deepEqual(christiesCatalogue(catalogue([lot])).lots, [lot]);
assert.throws(() => christiesCatalogue('<html>Challenge</html>'), /public catalogue/);
assert.throws(() => parseAntiquorum('<html>Challenge</html>', model, now), /public lot search/);
const results = parseAntiquorum(antique, model, now);
assert.equal(results.length, 1); // Skip estimates, a multi-watch bundle and a conservative parts-title rejection.
assert.equal(results[0].match, 'similar'); // The explicit coral dial conflicts with the requested blue dial.
assert.ok(results.some(l => l.price === 20000 && l.currency === 'USD' && l.observedAt === '2026-10-18'));
assert.ok(results.every(l => l.status === 'confirmed-sale' && l.country === 'UNKNOWN'));
assert.equal(parseAntiquorum(antique.replaceAll('Sold:', 'Estimate:'), model, now).length, 0);
assert.equal(parseChristies([{ ...lot, description_txt: 'A set of 6 wristwatches' }], model, now).length, 0);
assert.equal(parseAntiquorum(antique.replaceAll('/en/lots/', '//evil.example/en/lots/'), model, now).length, 0);
assert.equal(parseAntiquorum(antique.replaceAll('2026', '2027').replaceAll('2023', '2027'), model, now).filter(l => l.observedAt.startsWith('2027')).length, 0);
const archive = mergeListings([], [sale, ...results], now.toISOString());
assert.equal(mergeListings(archive, [], now.toISOString()).length, archive.length);
assert.ok(mergeListings(archive, [], now.toISOString()).every(l => l.status === 'confirmed-sale'));
const requested = [];
const fetcher = async url => {
  requested.push(String(url));
  return new Response(String(url).includes('antiquorum') ? antique : String(url).includes('auctionet') ? '{"items":[]}' : catalogue([lot]));
};
const collected = await collectAuctionSources(model, fetcher, now);
assert.equal(collected.sources.length, 3);
assert.ok(collected.sources.every(s => s.status === 'ok'));
assert.ok(requested.every(u => /^https:\/\/(catalog\.antiquorum\.swiss|onlineonly\.christies\.com|auctionet\.com\/api\/v2\/items\.json\?)/.test(u)));
const blocked = await collectAuctionSources(model, async url => String(url).includes('antiquorum') ? new Response('Denied', { status: 403 }) : String(url).includes('auctionet') ? new Response('<html>maintenance</html>') : new Response(catalogue([lot])), now);
assert.equal(blocked.sources.find(s => s.id === 'auctionet').status, 'error'); // A non-JSON answer is a changed source, not a sale.
assert.equal(blocked.sources.find(s => s.id === 'antiquorum').status, 'blocked');
assert.ok(blocked.listings.some(l => l.sourceId === 'christies'));

// Auctionet: only sold lots count, at the winning bid, dated by the closing bid; unsold lots with bids are ignored.
const auctionet = JSON.parse(await readFile('tests/fixtures/auctionet-submariner.json', 'utf8'));
const sub16610 = { id: 'rolex-16610', brand: 'Rolex', name: 'Submariner Date', reference: '16610' };
const an = parseAuctionet(auctionet, sub16610, now);
assert.deepEqual(an.map(l => [l.match, l.price, l.currency, l.status]), [['exact', 5000, 'EUR', 'confirmed-sale'], ['similar', 90000, 'SEK', 'confirmed-sale']]);
assert.equal(an[0].observedAt, '2021-07-17');
assert.match(an[0].title, /Balclis via Auctionet, winning bid \(buyer’s premium excluded\)/);
assert.ok(an[0].url.startsWith('https://auctionet.com/en/1786480-'));
assert.equal(parseAuctionet(auctionet, { id: 'rolex-116610lv', brand: 'Rolex', name: 'Submariner', reference: '116610LV' }, now).filter(l => l.match !== 'similar').length, 0);
assert.equal(parseAuctionet({ items: [{ ...auctionet.items[0], url: 'https://evil.test/en/1' }] }, sub16610, now).length, 0);
assert.throws(() => parseAuctionet({ error: 'x' }, sub16610, now), /Auctionet/);

console.log('New auction sources: realized amounts, sold outcomes, dates, currencies, URL bounds, variant evidence, archive retention and independent failures passed.');
