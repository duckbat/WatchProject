---
name: frontend-performance
description: "Diagnose WatchLedger rendering, image, search, chart or bundle performance when a frontend change warrants it."
---

# Frontend Performance

Inspect components/search-box.tsx, home-view.tsx, watch-detail.tsx, watch-photo.tsx and price-cache.tsx for the affected flow. Capture request count, interaction timing or a browser profile before selecting an optimization.

Keep lib/catalog.ts and lib/catalog-shards.ts on the server: the full catalog must not enter client bundles. Import lightweight collector matching modules directly; the collector barrel includes server dependencies.

Preserve search debounce, AbortController cleanup, bounded catalog responses and lazy image loading. Keep original exact-reference images and stable model IDs. Do not replace watch photos with similar dials.

Use bundle splitting, memoization or virtualization only for measured work. A scroll container does not virtualize a list; distinguish the two. Keep every catalogued dial selectable and searchable.

Verify the affected interaction in a browser, compare the same measurement before/after, and run typecheck/build for client import changes. Do not claim a performance improvement from build success alone.

Project evidence: [PROJECT_CONTEXT.md](../../../PROJECT_CONTEXT.md).
