import assert from 'node:assert/strict';
import { lib } from './helpers/lib.mjs';
const { parseEbaySoldCards, parseSoldDate } = await lib('ebay-sold-page');

assert.equal(parseSoldDate('Oct 28, 2026'), '2026-10-28');
assert.equal(parseSoldDate('3. Nov 2026'), '2026-11-03');
assert.equal(parseSoldDate('5 déc. 2026'), '2026-12-05');
assert.equal(parseSoldDate('yesterday'), null);

const us = parseEbaySoldCards([
  { url: 'https://www.ebay.com/itm/123456789012', text: 'Sold  Oct 28, 2026\nNew Listing\nRolex Submariner 124060 No Date 41mm Black 2023 Box Papers\nOpens in a new window or tab\nPre-Owned · Rolex · Submariner\n$11,250.00\nor Best Offer\n+$45.00 shipping\nfrom United Kingdom' },
  { url: 'https://www.ebay.com/itm/223456789012', text: 'Sold  Nov 2, 2026\nRolex Submariner 124060LN 2024 unworn\nBrand New\n$12,900.00\nBest offer accepted\nFree shipping' },
  { url: 'https://www.ebay.com/itm/323456789012', text: 'Rolex Submariner 124060 active listing\nPre-Owned\n$12,000.00\nBuy It Now' },
  { url: 'https://www.ebay.com/itm/123456789012', text: 'Sold  Oct 28, 2026\nduplicate card of the first item\n$1,000.00' },
  { url: 'https://evil.example/itm/423456789012', text: 'Sold  Oct 28, 2026\nRolex Submariner 124060 elsewhere\n$9,000.00' },
]);
assert.equal(us.length, 2, 'only sold, unique eBay items');
assert.deepEqual(
  [us[0].title, us[0].price, us[0].currency, us[0].status, us[0].soldAt, us[0].country, us[0].condition],
  ['Rolex Submariner 124060 No Date 41mm Black 2023 Box Papers', 11250, 'USD', 'confirmed-sale', '2026-10-28', 'GB', 'used'],
);
assert.deepEqual([us[1].status, us[1].country, us[1].condition], ['sold-asking', 'US', 'new'], 'best offer: last ask only; no "from" line: the site country');

const de = parseEbaySoldCards([{ url: 'https://www.ebay.de/itm/Rolex-Sub/523456789012?hash=1', text: 'Verkauft  3. Nov 2026\nRolex Submariner 124060 Full Set 2022\nGebraucht\nEUR 9.950,00\nPreisvorschlag\n+EUR 25,00 Versand' }]);
assert.deepEqual([de[0].url, de[0].price, de[0].currency, de[0].soldAt, de[0].country], ['https://www.ebay.de/itm/523456789012', 9950, 'EUR', '2026-11-03', 'DE']);
console.log('eBay sold-page checks passed: sold dates, best offers, seller country, duplicates and foreign links.');
