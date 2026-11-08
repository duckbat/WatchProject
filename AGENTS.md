# WatchLedger project guidance

This repository is the `watch-tracker/` application. Keep it a private watch-data tracker with a search-first home, regional comparisons and selectable exact-reference dials.

## graphify

- **graphify** (`~/.Codex/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

## Development skills

The core skills are reusable across projects and runtimes. Read [WATCHLEDGER_GUIDANCE.md](WATCHLEDGER_GUIDANCE.md) for this project's specialization and [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for verified paths. Load the applicable `.agents/skills/<name>/SKILL.md` on demand; do not load every skill for a small task.

| Task | Skill |
| --- | --- |
| Onboarding, architecture or cross-layer planning | architecture-discovery |
| Rendering, images, search or bundles | frontend-performance |
| Routes, collector latency or request fan-out | api-backend-performance |
| Queries, migrations or record ownership | database-integrity |
| Freshness, cache keys, invalidation or hosting caches | caching-infrastructure |
| Logs, timings, tracing or monitoring | observability |
| Controls, dial picker, loading or responsive UI | ux-accessibility |
| Authorization, fetching, untrusted data or secrets | security-privacy |
| Test selection and verification | testing-quality |
| Listings, sales, matching, shop prices or refreshes | data-pipeline |
| Scoped implementation or requested audit workflow | agent-workflow |

Use the current code as evidence; old notes and the shared chat are not proof of current behavior. A skill guides decisions and does not grant extra permissions or require unrequested infrastructure. Preserve concurrent edits, stable model IDs, personal data ownership and price provenance. Measure performance before claiming an improvement.

Examples: for a new auction source, read data-pipeline and testing-quality; for slow autocomplete, read frontend-performance and inspect the request path before changing caching.
