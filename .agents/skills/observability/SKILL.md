---
name: observability
description: "Investigate WatchLedger slow requests, refresh failures or data freshness when monitoring or instrumentation is requested."
---

# Observability

Start with existing SourceStatus records, fetchedAt/collectedAt and partial/error results in the collector/archive pipeline. Use available hosting logs for a reported production failure before adding instrumentation.

Measure provider latency, request counts, cache hit/miss, lock contention and archive age. For frontend work measure interaction responsiveness and layout stability in the real browser. Record environment and sample size.

Prefer minimal structured timings or existing tools when they answer the question. Add OpenTelemetry or real-user monitoring only when the task and available runtime justify the dependency and data collection.

Do not log credentials, contact details, personal collection payloads or signed URLs. Use provider/model identifiers and sanitized errors.

Verify instrumentation with one successful request and one controlled failure. Clearly distinguish local, fixture-based and hosted evidence; no performance budgets are established until baselines are measured.

Project evidence: [PROJECT_CONTEXT.md](../../../PROJECT_CONTEXT.md).
