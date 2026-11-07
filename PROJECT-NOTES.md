# WatchLedger

A private personal watch tracker. No selling or checkout flows.

Implemented: exact-reference catalog, custom models, owned-watch purchase records, custom marketplace/group sources, manual price observations, region/currency/source/status/condition/seller/date filters, mean and median, dated observation charts, JSON export. Records are persisted in D1 and scoped to the authenticated user.

On-demand Tori collection and an eBay Browse adapter are implemented; eBay needs server credentials. No historical price dataset is connected. Adding a custom URL registers a manual source. WatchCharts offers a licensed API; eBay sold-history API access is restricted; Reddit commercial API access requires approval. Tori public structured search was tested. Chrono24 returned an access challenge. Facebook group access is not configured. Do not describe saved sources as live integrations.

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

The explorer now uses /api/catalog with server-side search, brand filtering and pagination over a CC0 Timepiecepedia snapshot (40,757 entries including preserved legacy references). It does not ship the complete catalog to browser JavaScript. Catalog records can be used for collection records and price collection.
