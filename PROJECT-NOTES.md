# WatchLedger

A private personal watch tracker. No selling or checkout flows.

Implemented: exact-reference catalog, custom models, owned-watch purchase records, custom marketplace/group sources, manual price observations, region/currency/source/status/condition/seller/date filters, mean and median, dated observation charts, JSON export. Records are persisted in D1 and scoped to the authenticated user.

No automatic marketplace integrations or historical price dataset is connected. Adding a URL registers a manual source. WatchCharts offers a licensed API; eBay sold-history API access is restricted; Reddit commercial API access requires approval. Tori, Facebook groups and Chrono24 automated data access remain unverified. Do not describe saved sources as live integrations.

Comparisons use observations within the selected period, not an appraisal model. Currencies are kept separate. Seller country determines region; unknown locations are excluded from regional views. Box/papers are recorded but not valuation-adjusted. Cross-source duplicates require manual review. Charts connect observed dates without backfilling.

## Research
- https://watchcharts.com/watches/about
- https://watchcharts.com/api
- https://watchcharts.com/api/documentation
- https://developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html
- https://redditinc.com/policies/data-api-terms

## Checks
`npx tsc --noEmit`

`node --experimental-strip-types tests/market.test.mjs`

`npm run build`
