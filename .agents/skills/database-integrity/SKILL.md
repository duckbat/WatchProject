---
name: database-integrity
description: "Review query efficiency, data ownership, schema changes, migrations and concurrency when changing persistence."
---

# Database Integrity

Discover the database, driver, schema, transactions, migration tooling and actual query callers. Account for relational, document, embedded, serverless and other storage models instead of assuming SQL or TCP pooling.

Preserve stable identifiers, relationships and existing authorization/tenant constraints on reads and mutations. Check uniqueness, idempotency and concurrent updates where the change depends on them.

For query optimization inspect actual queries, representative cardinality and supported execution plans. Fix N+1 access or add indexes from evidence; include write cost and storage tradeoffs.

Design migrations around existing records, deployment ordering and failure recovery. Do not discard historical data or reinterpret absence/status fields merely to improve speed.

Use a disposable environment for mutation checks. Verify ownership boundaries, failed writes and meaningful concurrency cases. Parser or unit tests alone do not establish database behavior or production performance.
