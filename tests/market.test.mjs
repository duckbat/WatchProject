import assert from 'node:assert/strict';
import { summarize, inRegion, history, countries, currencies } from '../lib/market.ts';
assert.equal(summarize([300,100,200]),200);
assert.equal(summarize([100,300]),200);
assert.equal(summarize([100,200,600],'average'),300);
assert.equal(summarize([]),null);
assert.equal(inRegion('FI','EU'),true);
assert.equal(inRegion('GB','EU'),false);
assert.equal(inRegion('US','EU'),false);
assert.equal(inRegion('UNKNOWN','EU'),false);
assert.equal(inRegion('UNKNOWN','Global'),true);
assert.deepEqual(history([{observedAt:'2026-11-01',price:100},{observedAt:'2026-11-01',price:300},{observedAt:'2026-11-03',price:500}],'median'),[{date:'2026-11-01',value:200},{date:'2026-11-03',value:500}]);
console.log('Price aggregation and regional filter checks passed');

for (const country of ['JP','CN','HK','SG','KR','TW','IN','AE','TH','MY','ID','VN','PH']) { assert.equal(inRegion(country,'Asia'),true); assert(country in countries); }
for (const country of ['FI','US','GB','UNKNOWN']) assert.equal(inRegion(country,'Asia'),false);
assert(currencies.includes('JPY'));assert(currencies.includes('HKD'));assert(currencies.includes('SGD'));
import { parseEcbRates, convertPrice } from '../lib/market.ts';
const fx = parseEcbRates(`<Cube time='2026-11-06'><Cube currency='USD' rate='1.1165'/><Cube currency='JPY' rate='176.77'/><Cube currency='GBP' rate='0.83415'/><Cube currency='CHF' rate='0.9143'/><Cube currency='HKD' rate='8.7505'/></Cube>`);
assert.equal(fx.date, '2026-11-06'); assert.equal(Math.round(convertPrice(8999, 'USD', 'EUR', fx)), 8060);
assert.equal(Math.round(convertPrice(100, 'GBP', 'USD', fx)), 134); assert.equal(convertPrice(5, 'EUR', 'EUR', null), 5); assert.equal(convertPrice(5, 'AED', 'EUR', fx), null);
console.log('Exchange-rate checks passed');
