# WatchLedger project specialization

These rules apply to WatchLedger only. They were separated from the reusable development skills so other projects do not inherit watch, framework or hosting assumptions. Recheck the cited code before using historical details. Read PROJECT_CONTEXT.md for the verified architecture snapshot and DEVELOPMENT_AUDIT.md for the bounded adoption audit.

## security-privacy

Inspect app/chatgpt-auth.ts, app/api/records/route.ts, market/live and market/refresh, plus collector safeFetch. Verify authorization at the server boundary rather than trusting UI restrictions.

Preserve owner constraints on custom models and personal records. The public-catalog service refresh relies on an owner-private Sites gateway: re-evaluate that boundary before any audience/access change.

Validate untrusted data with existing Zod schemas and provider URL/origin checks. Keep user-submitted marketplace URLs out of automatic fetches. Enforce body/response and pagination limits at the actual trust boundary, not only in a UI.

Keep credentials server-side and out of source, command arguments, logs and fixtures. Follow the supported hosting credential workflow when publishing; a skill never grants extra access or approval.

Verify cross-owner rejection, malformed inputs, unsafe URLs and provider failures for the changed path. Fixtures should contain watch facts, not seller contacts. Do not bypass CAPTCHA or source access controls to fill a price gap.

## architecture-discovery

Read PROJECT_CONTEXT.md, then verify the affected paths against the current checkout. Start with package.json, app/page.tsx, app/api/, lib/, db/ and .openai/hosting.json. Treat PROJECT-NOTES.md as historical until verified.

Trace one actual flow from UI through route, validation, collector/archive and storage. Distinguish public catalog/market data from owner-scoped custom watches and records. Record file evidence and unknowns in PROJECT_CONTEXT.md.

For an audit, use DEVELOPMENT_AUDIT.md: separate demonstrated defects, static risks and unmeasured performance hypotheses. Inspect callers before proposing changes. Do not treat the shared chat's generic recommendations as repository findings.

Verify referenced files exist and relevant tests are executable. Discovery itself does not authorize unrelated behavior changes, data migrations or external publication.

## watch-data-pipeline

Trace lib/collectors/services/, matching/, core/listing.ts, live.ts and lib/market-archive/. Reuse safeFetch, CollectorResult, SourceStatus and collectedPrice validation.

Search discovery may use a base reference; identity evidence must distinguish full suffix, dial, size and brand where supplied. Dedicated source identity outranks incidental description text. Keep uncertain variants out of selected-variant prices; All dials deliberately broadens the scope.

Keep asking, sold-asking and confirmed-sale distinct. A disappeared listing, closed unsold lot, estimate, bid, stock counter or unavailable shop product never proves a completed sale. A reported amount is not necessarily seller proceeds; retain source fee basis and currency.

Use retailOffers for new shop/dealer offers; keep official MSRP separate and preserve current/archived availability. The used-market and new-price paths must not contaminate each other. Original dealer URLs deduplicate syndicated ads; stable source IDs prevent domain-change duplicates.

Keep listing/sale date separate from observation/collection time. Unknown dates and seller countries stay unknown. Convert using the existing FX path and expose original amounts; currency is not seller location.

Wire new sources into the existing archive, filters/status display and unattended refresh path. Bound work and isolate failures. Consult MARKETPLACES.md for actual source access and coverage; do not promise exhaustive sold history.

Verify real and adversarial fixtures, archive retention/reclassification and one bounded live fetch when feasible. Treat a blocked source as unavailable, not as proof no watches exist.

## api-backend-performance

Trace app/api/catalog/route.ts, app/api/market/live/route.ts and lib/market-archive/watch-market.ts as relevant. Measure cache-hit and cache-miss latency separately and inspect actual request fan-out.

Use Promise.allSettled for independent providers so one failure does not discard other prices. Preserve safeFetch timeouts, response limits, no-redirect behavior and host backoff. Bound detail fetches and pagination.

Preserve catalog query validation and response bounds. Return stale observations with source failure information where the archive supports it; never manufacture success or sale status.

The shared refresh route updates public catalog data behind the owner-private Sites gateway. Custom watch collection remains owner-scoped. Keep refresh locks and minimum refresh intervals.

Verify affected routes and failure isolation with tests/collectors.test.mjs, tests/shops.test.mjs or auction tests. Do not add AI streaming, queues or application load balancers without an actual requirement.

## observability

Start with existing SourceStatus records, fetchedAt/collectedAt and partial/error results in the collector/archive pipeline. Use available hosting logs for a reported production failure before adding instrumentation.

Measure provider latency, request counts, cache hit/miss, lock contention and archive age. For frontend work measure interaction responsiveness and layout stability in the real browser. Record environment and sample size.

Prefer minimal structured timings or existing tools when they answer the question. Add OpenTelemetry or real-user monitoring only when the task and available runtime justify the dependency and data collection.

Do not log credentials, contact details, personal collection payloads or signed URLs. Use provider/model identifiers and sanitized errors.

Verify instrumentation with one successful request and one controlled failure. Clearly distinguish local, fixture-based and hosted evidence; no performance budgets are established until baselines are measured.

## database-integrity

Inspect db/index.ts, db/schema.ts and relevant app/api/records or market-archive callers. The database is Cloudflare D1 through Drizzle; do not add TCP connection pooling.

The records table stores id, owner, kind and JSON payload. Personal reads/writes/deletes must constrain owner on the server. Public market history uses MARKET_OWNER; custom-model archives use the authenticated owner.

Preserve catalog IDs and existing observation amounts/statuses. Missing ads are retained observations, not sales. Archive merge and reclassification rules live in lib/market-archive/listings.ts.

Before adding indexes, inspect the actual SQL and an execution plan against representative data. Consider owner/kind queries and JSON expansion costs; do not claim a speedup without measurements. Migrations must preserve existing data and be reversible where feasible.

Use a disposable database for mutation tests. Test ownership boundaries and failed writes explicitly; pure parser tests do not establish database authorization or concurrency safety.

## testing-quality

Use tests/helpers/lib.mjs for pure lib tests; it preserves module paths and replaces the Vite-only catalog shard loader for Node. Do not import cloudflare:workers modules into an unconfigured Node test.

Select checks by behavior: collectors/shops/auction-sources/auction-history for provider data; search-popularity/catalog for catalog/variant rules; metrics/market/new-price for price calculations; post-import for manual imports.

Run node_modules/.bin/tsc --noEmit for TypeScript changes. Use the existing build workflow for runtime/client boundaries. Check package.json; do not invent npm test when no such script exists.

Write small fixture-based tests for new money, parsing, status, identity or security branches. Cover misleading data: estimates, last bids, wrong dials, unavailable inventory and undisclosed accepted offers.

API smoke scripts can create/delete records; inspect them and use a disposable identity/database. Pure tests do not prove live-source access, browser behavior or deployed authentication.

Report checks actually run and material gaps. Do not require a full audit or unrelated tests for a small reversible change.

## agent-workflow

Read AGENTS.md and the relevant PROJECT_CONTEXT.md paths. Inspect git status and preserve concurrent edits. Load only the skill sections needed for the user's task, not the entire pack.

Define the smallest observable outcome and trace affected callers before editing. Existing session authorization persists; do not add a new approval gate for routine reversible work. Skills do not authorize unrelated external writes.

Diagnose before optimizing. Preserve owner-scoped data, stable references, selected-dial semantics and source evidence. Use existing helpers before new dependencies or abstractions.

For requested audits, record findings before implementing fixes; for an ordinary bug fix, do not impose a whole-project audit. Separate observed defects from hypotheses and honor the user's authorized scope.

Run relevant checks from testing-quality and report concrete outcomes, limits and changed paths. Project guidance can be updated as part of this repo; user memory must not be changed without an explicit request.

For application publication, follow the project's hosting workflow, preserve its existing Site identity/audience and verify the exact built source. Documentation-only skill installation does not require a production redeploy.

## caching-infrastructure

Inspect lib/fx.ts, lib/market-archive/watch-market.ts, popularity.ts, components/price-cache.tsx and route Cache-Control headers. Read TTLs from code instead of copying historical numbers.

Identify each cache's scope: isolate-local, browser-local, D1-persisted or HTTP. Worker isolate maps are not durable or globally shared. Distinguish a last-observed price from verified current inventory.

Include every value-affecting dimension in a key, or restrict cache writes to a documented canonical scope. Preserve the canonical-scope guard around RememberPrice in watch-detail.tsx. Keep personal records and live authenticated responses out of public caches.

Bump matching/collector versions when changed semantics require archive reclassification/refetch. Preserve minimum refresh limits and lock expiry.

Compression, CDN behavior and server placement are hosting concerns: inspect actual response headers before changing them. Do not introduce Redis or change the owner-private audience to implement caching.

Verify hit, miss, stale, failure and invalidation paths using fake time where practical, then check hosted behavior separately from local preview.

## ux-accessibility

Reuse existing components, app/app.css tokens, button shapes and focus treatments. Preserve the search-first tracker and regional comparisons; do not add a selling workflow.

Every catalogued dial/bracelet must remain reachable. Variant choices show the full reference, selection state and meaningful label; distinguish Palm/fluted motif from a fluted bezel. Preserve the deliberate All dials versus selected-dial scope.

Provide keyboard access, accessible names, visible focus and useful empty/error/loading states. Source failures must not look like zero market activity. Do not rely on color alone for status or selection.

Optimistic writes need rollback and error feedback. Do not optimistically label a listing sold or a transaction verified. Currency conversion and unknown seller location must remain understandable.

Verify the actual changed control with keyboard and pointer, relevant narrow/desktop layouts, empty results and errors. Capture a screenshot for visible UI changes. Typecheck is not browser verification.

## frontend-performance

Inspect components/search-box.tsx, home-view.tsx, watch-detail.tsx, watch-photo.tsx and price-cache.tsx for the affected flow. Capture request count, interaction timing or a browser profile before selecting an optimization.

Keep lib/catalog.ts and lib/catalog-shards.ts on the server: the full catalog must not enter client bundles. Import lightweight collector matching modules directly; the collector barrel includes server dependencies.

Preserve search debounce, AbortController cleanup, bounded catalog responses and lazy image loading. Keep original exact-reference images and stable model IDs. Do not replace watch photos with similar dials.

Use bundle splitting, memoization or virtualization only for measured work. A scroll container does not virtualize a list; distinguish the two. Keep every catalogued dial selectable and searchable.

Verify the affected interaction in a browser, compare the same measurement before/after, and run typecheck/build for client import changes. Do not claim a performance improvement from build success alone.
