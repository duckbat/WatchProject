---
name: caching-infrastructure
description: "Review WatchLedger cache freshness, invalidation and deployment assumptions when changing caches or hosting."
---

# Caching Infrastructure

Inspect lib/fx.ts, lib/market-archive/watch-market.ts, popularity.ts, components/price-cache.tsx and route Cache-Control headers. Read TTLs from code instead of copying historical numbers.

Identify each cache's scope: isolate-local, browser-local, D1-persisted or HTTP. Worker isolate maps are not durable or globally shared. Distinguish a last-observed price from verified current inventory.

Include every value-affecting dimension in a key, or restrict cache writes to a documented canonical scope. Preserve the canonical-scope guard around RememberPrice in watch-detail.tsx. Keep personal records and live authenticated responses out of public caches.

Bump matching/collector versions when changed semantics require archive reclassification/refetch. Preserve minimum refresh limits and lock expiry.

Compression, CDN behavior and server placement are hosting concerns: inspect actual response headers before changing them. Do not introduce Redis or change the owner-private audience to implement caching.

Verify hit, miss, stale, failure and invalidation paths using fake time where practical, then check hosted behavior separately from local preview.

Project evidence: [PROJECT_CONTEXT.md](../../../PROJECT_CONTEXT.md).
