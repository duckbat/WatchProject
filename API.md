# WatchProject market-data API

All data endpoints use the existing private Site sign-in session. Requests without an authenticated user receive 401. The GitHub connection is for source management; the tracker does not request GitHub access from visitors.

## Collect and review

`GET /api/market/collect` returns collector capabilities.

`POST /api/market/collect`

```json
{"modelId":"seiko-spb143","provider":"tori"}
```

Returns `candidates`, collection timestamp and coverage. It never silently imports candidates. After reviewing a candidate, save it with `POST /api/records` and `{ "kind": "observation", "data": <candidate> }`. The UI implements this flow with **Collect market data**.

Supported collector parameters: `provider` = `tori` or `ebay`; eBay additionally accepts `marketplace` = `EBAY_DE` (default), `EBAY_US`, `EBAY_GB`, `EBAY_FR`, `EBAY_IT`, `EBAY_ES`.

- **Tori.fi**: fetches public search-page structured data; no login or private endpoints. First page only. Strict brand and exact reference match. Related recommendations and common parts/accessories are excluded. No guarantee of complete coverage, ongoing availability, or exact-variant identification from a title. Inspect the linked listing before saving.
- **eBay**: Browse API with OAuth client credentials. Set `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` as server secrets. Production API access is required. Up to 50 active listings per query. No sold-price access is claimed.
- **Chrono24**: observed access challenge; returns `unsupported_source` rather than bypassing it.
- **Reddit / Facebook groups**: not configured; no private-group scraper. A custom source URL remains manual until a supported collector exists.

Provider URLs are fixed in server code. Custom user URLs are never fetched server-side (prevents private-network requests). Fetches reject redirects, time out after 15 seconds, cap responses at 3 MB and stop on source errors. One request per user per minute, enforced by an atomic database key. No background scheduler is installed. Repeat collection on demand to accumulate history.

Unknown condition, seller type, box/papers and location stay unknown. Asking prices never become confirmed sales. Re-importing the same URL on the same date is rejected. Cross-source duplicate detection remains manual.

## Query market data

`GET /api/market?modelId=seiko-spb143&region=EU&currency=EUR&basis=asking&statistic=median&days=30`

Optional `sourceId`. Regions: Global, EU, US, FI, GB, CH. Currencies: EUR, USD, GBP, CHF. Price types: asking, confirmed-sale, sold-asking. Statistics: median, average. Days: 1–36500.

Returns price, unique-listing sample size, observation count, dated history and latest observations. Current API comparison uses the latest observation per URL within the period to reduce repeated-listing bias. The dashboard applies the same latest-listing rule; the dated chart groups observations by day. Neither is an appraisal, and neither reconstructs historical prices before collection began.

## Development

`npm run dev` starts the app. `npm run db:generate` generates pending schema migrations. See README for local D1 migration instructions. Tests: `node tests/collectors.test.mjs`, `node --experimental-strip-types tests/market.test.mjs`, `npx tsc --noEmit`, `npm run build`.

Watch photos use externally hosted reference-specific photos with credits in the app. Broken/missing photos render an empty watch icon. External photos may disappear; attribution is not a reuse license. For broader distribution, replace them with your own or licensed photos. Custom watch photo URLs are optional.

Source references: [eBay Browse API](https://developer.ebay.com/api-docs/buy/api-browse.html), [Tori public search](https://www.tori.fi/recommerce/forsale/search).
