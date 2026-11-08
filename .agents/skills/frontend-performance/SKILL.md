---
name: frontend-performance
description: "Diagnose frontend rendering, interaction latency, images, large lists or bundle size when a UI performance change is needed."
---

# Frontend Performance

Inspect the actual UI framework, component boundaries and resource-loading path. Capture a representative interaction profile, request count or bundle report before choosing an optimization.

Keep large datasets and server-only dependencies outside browser bundles. Preserve cancellation or stale-response guards for asynchronous search and avoid duplicate work across component mounts.

Prioritize visible content and appropriately sized images. Preserve asset identity, dimensions, meaningful fallbacks and accessibility; use responsive images, lazy loading or font changes when relevant to the measured bottleneck.

Apply memoization, code splitting and virtualization only where they remove demonstrated work. A bounded or scrollable list may be sufficient; scrolling alone is not virtualization.

Verify the same interaction and data volume before/after, including loading, empty and failure states. Use the project's build/type checks for changed boundaries; build success alone does not prove a performance gain. For non-UI workloads use the relevant backend skill instead.
