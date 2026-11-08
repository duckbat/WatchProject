# Development skills adoption audit

Scope: the files listed in PROJECT_CONTEXT.md, inspected on 2026-11-08 to tailor the skill pack. This is a bounded static review; no application behavior was changed. The shared chat explicitly did not inspect this repository. Its video summary is treated as supplied context, not independently verified video evidence.

## Existing practices to preserve

- Search already debounces/cancels requests; catalog search is paginated on the server.
- Images already load lazily with fallback; catalog shards stay behind server-side lookup.
- Collector requests already have timeout/size limits, host backoff and independent failure reporting.
- D1 market archives already have refresh/version checks and a lock. Missing listings are retained without inferring sales.
- Selected-variant identity and sold-price evidence have dedicated matching and fixture checks.
- New-shop offers and official MSRP have separate representations; card caches have a canonical-scope write guard.

## Follow-up candidates, ranked by impact

| Priority | Evidence | Consequence and verification needed |
| --- | --- | --- |
| P1 before any audience expansion | `app/api/market/refresh/route.ts` relies on the owner-private Sites gateway, unlike the visitor-authenticated live route. | This is a deployment invariant, not a demonstrated unauthorized-access bug. Verify actual gateway denial and service access before changing sharing. No access-policy change was made. |
| P2 | `app/api/records/route.ts` checks Content-Length before `req.json()`; the header check alone does not enforce a limit on an undeclared/chunked body. | Confirm effective platform body limits with a bounded disposable request before selecting a byte-counting parser. Authenticated route scope reduces exposure; runtime exploitability was not tested. |
| P2 measurement | `db/schema.ts` declares only the primary key; owner/kind predicates and archive JSON expansion appear in records/popularity/refresh callers. | Inspect deployed indexes and query plans at representative scale. Consider an owner/kind index or persisted summaries only if measurements justify them. No latency defect or index speedup is claimed. |
| P2 measurement | Shared refresh selects due work from stored archives; archive merging retains historical listing observations. | Measure payload growth, D1 reads and refresh latency as tracked-reference count grows. Decide retention, pagination or queue changes from that evidence; do not delete history merely to reduce size. |
| P3 | No production frontend performance baseline or validated deployment compression behavior was gathered for this installation. | Profile search, dial selection and charts on representative data/devices; inspect actual response headers before selecting bundle, font, virtualization or infrastructure changes. |

## Adoption completed

Eleven project-local skills were authored from the shared discussion and current code. AGENTS.md routes only relevant skills; CLAUDE.md and the Cursor rule point to that same guidance. The authored `.agents/` pack is no longer Git-ignored. The desktop workspace has a small pointer to the application repository.

## Applying a finding

For an authorized follow-up, first reproduce or measure the relevant path, state the intended observable outcome, implement the smallest justified change, and verify ownership/data invariants plus focused tests. This audit does not introduce an approval gate for ordinary bug fixes or authorize a broad refactor.
