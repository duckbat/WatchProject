---
name: caching-infrastructure
description: "Review cache scope, freshness, invalidation, compression and deployment caching when changing performance or infrastructure."
---

# Caching Infrastructure

Map the relevant caches: request-local, process/isolate, client, persistent, distributed or HTTP/CDN. Read current TTLs and invalidation rules from code/configuration; process-local state is not globally shared or durable.

Include all value-affecting dimensions in a cache key, or enforce a documented canonical scope. Keep private/tenant-specific responses out of shared caches unless isolation is explicit and verified.

Define hit, miss, expiry, stale, failure and invalidation behavior. Preserve refresh throttles and stampede protection. Use versioning or revalidation when a semantic change makes cached values obsolete.

Inspect actual deployment response headers and runtime capabilities before changing compression, asset caching, region placement or background refresh behavior.

Introduce a distributed cache or new infrastructure only when the workload and measurements justify its operational cost. Validate freshness and isolation as well as latency; local tests do not prove CDN or production behavior.
