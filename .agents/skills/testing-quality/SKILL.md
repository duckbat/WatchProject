---
name: testing-quality
description: "Select meaningful WatchLedger checks when implementing or reviewing changes and reporting their evidence."
---

# Testing Quality

Use tests/helpers/lib.mjs for pure lib tests; it preserves module paths and replaces the Vite-only catalog shard loader for Node. Do not import cloudflare:workers modules into an unconfigured Node test.

Select checks by behavior: collectors/shops/auction-sources/auction-history for provider data; search-popularity/catalog for catalog/variant rules; metrics/market/new-price for price calculations; post-import for manual imports.

Run node_modules/.bin/tsc --noEmit for TypeScript changes. Use the existing build workflow for runtime/client boundaries. Check package.json; do not invent npm test when no such script exists.

Write small fixture-based tests for new money, parsing, status, identity or security branches. Cover misleading data: estimates, last bids, wrong dials, unavailable inventory and undisclosed accepted offers.

API smoke scripts can create/delete records; inspect them and use a disposable identity/database. Pure tests do not prove live-source access, browser behavior or deployed authentication.

Report checks actually run and material gaps. Do not require a full audit or unrelated tests for a small reversible change.

Project evidence: [PROJECT_CONTEXT.md](../../../PROJECT_CONTEXT.md).
