import assert from 'node:assert/strict';
import { lib } from './helpers/lib.mjs';
const { planRefresh, popularRolexModels, POPULAR_ROLEX, REFRESH_AFTER_MS } = await lib('market-archive/refresh-plan');
const { ebayBlocked, ebayLimits, EBAY_CALLS_PER_REFRESH } = await lib('market-archive/ebay-limits');
const { allModels, findCatalogModel } = await lib('catalog');

// Every popular reference resolves to one Rolex catalog model; a viewed dial is preferred over the first dial.
const popular = popularRolexModels(new Set());
assert.equal(popular.length, POPULAR_ROLEX.length);
assert(popular.every((m) => m.brand === 'Rolex'));
const datejust = allModels.filter((m) => m.brand === 'Rolex' && m.reference.startsWith('126200-'));
const viewedDial = datejust.at(-1);
assert(popularRolexModels(new Set([viewedDial.id])).some((m) => m.id === viewedDial.id));

const now = Date.parse('2026-11-09T12:00:00Z');
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const sub = popular.find((m) => m.reference.startsWith('124060'));
const omega = allModels.find((m) => m.brand === 'Omega');
const tudor = allModels.find((m) => m.brand === 'Tudor');
const fresh = popular.filter((m) => m.id !== sub.id).map((m) => ({ modelId: m.id, fetchedAt: iso(60_000) }));

// Popular Rolexes come first and use eBay; other viewed watches follow without eBay, most overdue first.
let plan = planRefresh([...fresh, { modelId: sub.id, fetchedAt: iso(REFRESH_AFTER_MS + 1) }, { modelId: omega.id, fetchedAt: iso(REFRESH_AFTER_MS * 3) }, { modelId: tudor.id, fetchedAt: iso(REFRESH_AFTER_MS * 2) }], findCatalogModel, 5, now);
assert.deepEqual(plan.jobs.map((j) => [j.model.id, j.ebay, j.reason]), [[sub.id, true, 'popular'], [omega.id, false, 'viewed'], [tudor.id, false, 'viewed']]);
assert.equal(plan.due, 3);

// Recently refreshed watches wait; the batch limit applies; never-collected popular watches are due first.
plan = planRefresh([...fresh, { modelId: sub.id, fetchedAt: iso(60_000) }, { modelId: omega.id, fetchedAt: iso(60_000) }], findCatalogModel, 5, now);
assert.equal(plan.jobs.length, 0);
plan = planRefresh([{ modelId: omega.id, fetchedAt: iso(REFRESH_AFTER_MS * 10) }], findCatalogModel, 2, now);
assert.equal(plan.jobs.length, 2);
assert(plan.jobs.every((j) => j.reason === 'popular'));
assert.equal(plan.due, POPULAR_ROLEX.length + 1);
// Custom (non-catalog) archives are never refreshed by the schedule.
assert.equal(planRefresh([...fresh, { modelId: sub.id, fetchedAt: iso(60_000) }, { modelId: 'user-model-1', fetchedAt: iso(REFRESH_AFTER_MS * 2) }], findCatalogModel, 5, now).jobs.length, 0);

// A watch whose refresh failed recently waits; the next due watch is taken instead.
plan = planRefresh([...fresh, { modelId: sub.id, fetchedAt: iso(REFRESH_AFTER_MS * 2) }, { modelId: omega.id, fetchedAt: iso(REFRESH_AFTER_MS * 2) }], findCatalogModel, 1, now, [{ modelId: sub.id, fetchedAt: iso(60_000) }]);
assert.deepEqual(plan.jobs.map((j) => j.model.id), [omega.id]);

// eBay budget: background refreshes stop at their share; page views stop near the daily limit.
const limits = ebayLimits({});
assert.deepEqual(limits, { daily: 4800, background: 3000 });
assert.deepEqual(ebayLimits({ EBAY_DAILY_CALLS: '2000', EBAY_BACKGROUND_CALLS: '5000' }), { daily: 2000, background: 2000 });
assert.equal(ebayBlocked({ date: 'd', calls: 0, background: 0 }, limits, true), null);
assert.match(ebayBlocked({ date: 'd', calls: 3000, background: 3000 - EBAY_CALLS_PER_REFRESH + 1 }, limits, true), /background/);
assert.equal(ebayBlocked({ date: 'd', calls: 3000, background: 3000 }, limits, false), null, 'page views can still use the rest');
assert.match(ebayBlocked({ date: 'd', calls: 4800 - EBAY_CALLS_PER_REFRESH + 1, background: 0 }, limits, false), /used up/);
console.log(`Scheduled refresh checks passed: ${POPULAR_ROLEX.length} popular Rolexes first with eBay, others without, batch limit, eBay budget.`);
