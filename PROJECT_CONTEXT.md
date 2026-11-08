# WatchLedger architecture evidence

Verified from the local checkout on 2026-11-08. Recheck affected code before treating this snapshot as current. This is source inspection, not a production performance or security certification.

## Runtime and boundaries

- `package.json`, `scripts/run-framework.mjs`: TypeScript, React, Next-compatible app routes through Vinext/Vite; portable and managed execution profiles. Follow the existing build scripts rather than replacing the framework.
- `.openai/hosting.json`, `db/index.ts`: Cloudflare Worker hosting with the D1 `DB` binding; Drizzle uses the D1 adapter. This is not a conventional Node server with a TCP database pool. Preserve the existing Site identity and access policy.
- `app/page.tsx`: client application shell, navigation, preferences and personal records. `components/` holds search, watch detail, favourites, charts and collection views; `app/app.css` holds the established UI styles.
- `app/chatgpt-auth.ts`, `app/api/records/route.ts`: authenticated personal data. The records route validates payloads with Zod and constrains records to the signed-in owner.

## Catalog and UI

- `data/catalog/shards/`, `lib/catalog-shards.ts`, `lib/catalog.ts`: imported reference metadata and server-side search/grouping. Stable IDs are referenced by saved watches and observations. Do not ship the whole catalog into a client component.
- `app/api/catalog/route.ts`: bounded paginated search, explicit ID lookup, full variant lookup and market-enriched cards. The variant path intentionally returns every sibling, unlike paginated search.
- `components/search-box.tsx`: debounced remote search with AbortController cancellation and keyboard/selection behavior.
- `components/watch-photo.tsx`: lazy original-reference images with a failure fallback. Catalog metadata licensing does not establish image rights.
- `components/watch-detail.tsx`: selected-dial versus All dials scope, searchable full-reference variant picker, market charts, shop offers and new-watch price views. Preserve the separation of shop offers, official MSRP and market observations.
- `components/price-cache.tsx`: bounded browser card-price cache by model/currency. `RememberPrice` is guarded in watch-detail.tsx to write only the canonical global one-year median scope, avoiding regional/filter-specific card pollution.

## Market data flow

1. `app/api/market/live/route.ts` authenticates the caller, resolves a public catalog model or owner-scoped custom model, then calls `watchMarket`.
2. `lib/market-archive/watch-market.ts` applies freshness/version rules and a D1 refresh lock; collectors and forum/auction/shop work run independently with partial failure handling.
3. `lib/collectors/services/` contains provider adapters. `core/http.ts` bounds time and response size, rejects redirects and applies isolate-local host backoff. `matching/` owns reference, dial and structured identity checks.
4. `core/listing.ts` validates observations; `market-archive/listings.ts` merges stable/original dealer URLs and retains missing listings without inferring a sale.
5. `lib/metrics.ts`, `lib/market.ts` and `lib/fx.ts` handle statistics, filters and conversion. Preserve original currency and source evidence; seller country determines region.
6. `lib/market-archive/popularity.ts` caches shared market summaries and expands archived listings through D1 JSON queries; this is a possible scaling measurement target, not a measured latency defect.

`app/api/market/refresh/route.ts` provides the unattended public-catalog refresh path. It relies on the owner-private Sites gateway for service authentication and does not accept arbitrary external URLs or personal model IDs. Inspect the deployment audience before changing that boundary. See MARKETPLACES.md for bounded source coverage and status semantics.

## Storage and checks

`db/schema.ts` defines a records table with `id` primary key, `owner`, `kind` and JSON `payload`. Shared market history and personal records occupy different owner scopes. No owner/kind secondary index is declared in that schema; inspect actual deployed indexes and query plans before recommending a migration.

Representative pure checks are `node tests/collectors.test.mjs`, `node tests/shops.test.mjs`, `node tests/auction-sources.test.mjs`, `node tests/auction-history.test.mjs`, `node tests/search-popularity.test.mjs`, `node tests/catalog.test.mjs`, `node tests/metrics.test.mjs`, `node tests/market.test.mjs`, `node tests/new-price.test.mjs` and `node tests/post-import.test.mjs`. Select those affected by the change. Use `node_modules/.bin/tsc --noEmit` for TypeScript changes and the supported framework build for runtime/client boundary changes. Python API smoke scripts may mutate records: inspect their setup before running.

## Unknowns and intentional exclusions

No production query plans, traffic profile, Web Vitals baseline, compression headers or live ownership attacks were measured during skill installation. No full-repository audit was performed. Redis, load balancers, AI response streaming, universal virtualization and new tracing dependencies are not justified by the shared video's generic advice alone.

Skill routing is in AGENTS.md. The reusable core is now stack-agnostic; WATCHLEDGER_GUIDANCE.md preserves the project-specific specialization, and DEVELOPMENT_SKILLS.md describes the user-level installation. Scoped static findings and follow-up verification are in DEVELOPMENT_AUDIT.md.
