---
name: observability
description: "Investigate failures, latency, freshness or regressions when diagnostics or instrumentation is requested."
---

# Observability

Start with existing logs, metrics, traces, error/status objects and the reported request or interaction. Establish environment, timestamps, request correlation and a representative baseline before adding instrumentation.

Measure the relevant boundary: dependency duration, fan-out, cache outcome, queue delay, data age, database work or user interaction. Record sample size and separate client, server and external-provider time.

Prefer an existing diagnostic tool or small structured measurement when it answers the question. Add tracing or real-user monitoring only when the required visibility and runtime justify it.

Avoid logging secrets, private payloads or sensitive identifiers. Consider sampling, retention and high-cardinality labels before shipping telemetry.

Verify successful and controlled failure cases. Distinguish source inspection, fixture tests, local measurements and production evidence. Set performance budgets from measured baselines and user requirements rather than invented thresholds.
