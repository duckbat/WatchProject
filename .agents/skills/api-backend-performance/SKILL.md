---
name: api-backend-performance
description: "Diagnose WatchLedger route latency, collector fan-out or unnecessary requests when changing APIs and refresh behavior."
---

# Api Backend Performance

Trace app/api/catalog/route.ts, app/api/market/live/route.ts and lib/market-archive/watch-market.ts as relevant. Measure cache-hit and cache-miss latency separately and inspect actual request fan-out.

Use Promise.allSettled for independent providers so one failure does not discard other prices. Preserve safeFetch timeouts, response limits, no-redirect behavior and host backoff. Bound detail fetches and pagination.

Preserve catalog query validation and response bounds. Return stale observations with source failure information where the archive supports it; never manufacture success or sale status.

The shared refresh route updates public catalog data behind the owner-private Sites gateway. Custom watch collection remains owner-scoped. Keep refresh locks and minimum refresh intervals.

Verify affected routes and failure isolation with tests/collectors.test.mjs, tests/shops.test.mjs or auction tests. Do not add AI streaming, queues or application load balancers without an actual requirement.

Project evidence: [PROJECT_CONTEXT.md](../../../PROJECT_CONTEXT.md).
