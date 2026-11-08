import assert from 'node:assert/strict';
import { computeMetrics, dedupeCrossPosts, median, weeklyMedians, withoutOutliers } from '../lib/metrics.ts';
const now = Date.parse('2026-11-08T12:00:00Z');
assert.equal(median([3, 1, 2]), 2); assert.equal(median([]), null);
const p = (date, price, extra = {}) => ({ date, price, status: 'asking', ...extra });
assert.deepEqual(weeklyMedians([p('2026-11-02', 100), p('2026-11-08', 300), p('2026-11-09', 50)]).map((w) => w.week), ['2026-11-02', '2026-11-09']);
const xs = [p('2026-01-05', 10000), p('2026-04-06', 10400), p('2026-07-06', 9800), p('2026-10-05', 9000, { active: true, listedAt: '2026-10-09' }),
  p('2026-10-12', 9500, { condition: 'new', contents: 'full-set', sellerType: 'dealer' }), p('2026-10-13', 9700, { condition: 'new', contents: 'full-set', sellerType: 'dealer' }),
  p('2026-10-14', 8500, { condition: 'used', contents: 'watch-only', status: 'sold-asking' }), p('2026-10-15', 8700, { condition: 'used', contents: 'watch-only' }), p('2024-05-01', 7000)];
const m = computeMetrics(xs, { retail: 7850, market: 9000, now });
assert.equal(m.inception, '2024-05-01'); assert.equal(m.volume1y, 8); assert.equal(m.sold1y, 1);
assert.equal(m.medianDaysListed, 30); assert.equal(Math.round(m.newPremium * 100), 12); assert(m.noBoxDiscount < 0);
assert.equal(m.dealerPrice, 9600); assert(m.volatility > 0 && m.volatility < 0.2); assert.equal(m.change1y, null); // one early-year price is not a trend
const trend = computeMetrics([p('2025-11-20', 10000), p('2025-12-10', 10200), p('2026-01-15', 9900), p('2026-09-01', 9000), p('2026-10-01', 9100), p('2026-11-01', 8900)], { now });
assert.equal(Math.round(trend.change1y * 1000), -100);
assert.equal(Math.round(m.valueRetention * 1000), 146); assert(m.risk && m.risk.score >= 0 && m.risk.score <= 100 && m.risk.checks.length === 5);
const empty = computeMetrics([], { now }); assert.equal(empty.volatility, null); assert.equal(empty.risk, null); assert.equal(empty.inception, null);
console.log('Metric checks passed: volatility, change, retention, inception, volume, days listed, condition/box premiums, dealer price, risk score.');

const prices = [8800, 9000, 9100, 9200, 9300, 500, 45000];
const { kept, dropped } = withoutOutliers(prices, (x) => x);
assert.deepEqual(dropped.sort((a, b) => a - b), [500, 45000]); assert.equal(kept.length, 5);
assert.equal(withoutOutliers([500, 9000, 9100], (x) => x).dropped.length, 0); // too few prices to judge
assert.equal(withoutOutliers([9000, 9000, 9000, 9000, 9000, 9400], (x) => x).dropped.length, 0); // identical prices do not reject a close one
const posts = dedupeCrossPosts([
  { title: '[WTS] Rolex Datejust 36 126200 Blue Jubilee', price: 8500, date: '2026-11-01' },
  { title: 'FS: Rolex Datejust 36 126200 Blue Jubilee', price: 8500, date: '2026-11-03' },
  { title: '[WTS] Rolex Datejust 36 126200 Blue Jubilee', price: 8500, date: '2026-06-01' },
  { title: '[WTS] Rolex Datejust 36 126200 Silver Oyster', price: 8500, date: '2026-11-02' },
]);
assert.equal(posts.length, 3); // Reddit + forum cross-post counted once; a re-post months later and a different variant are kept
assert.equal(posts.find((x) => x.date === '2026-11-01'), undefined);
const auctionLots = [1, 2].map(() => ({ title: 'Rolex Datejust Ref. 126200 reported result', price: 8500, date: '2026-11-03', status: 'confirmed-sale' }));
assert.equal(dedupeCrossPosts(auctionLots).length, 2); // Equal prices and titles do not establish that two auction lots are one watch.
console.log('Outlier and cross-post checks passed.');
