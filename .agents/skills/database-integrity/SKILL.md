---
name: database-integrity
description: "Review WatchLedger D1 queries, record ownership, migrations and archive integrity when changing persistence."
---

# Database Integrity

Inspect db/index.ts, db/schema.ts and relevant app/api/records or market-archive callers. The database is Cloudflare D1 through Drizzle; do not add TCP connection pooling.

The records table stores id, owner, kind and JSON payload. Personal reads/writes/deletes must constrain owner on the server. Public market history uses MARKET_OWNER; custom-model archives use the authenticated owner.

Preserve catalog IDs and existing observation amounts/statuses. Missing ads are retained observations, not sales. Archive merge and reclassification rules live in lib/market-archive/listings.ts.

Before adding indexes, inspect the actual SQL and an execution plan against representative data. Consider owner/kind queries and JSON expansion costs; do not claim a speedup without measurements. Migrations must preserve existing data and be reversible where feasible.

Use a disposable database for mutation tests. Test ownership boundaries and failed writes explicitly; pure parser tests do not establish database authorization or concurrency safety.

Project evidence: [PROJECT_CONTEXT.md](../../../PROJECT_CONTEXT.md).
