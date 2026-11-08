---
name: api-backend-performance
description: "Diagnose backend latency, API request fan-out, expensive jobs or response efficiency when changing server behavior."
---

# Api Backend Performance

Trace the slow route/job through validation, authorization, storage and external calls. Measure cache hits separately from misses and include realistic concurrency and tail latency where relevant.

Run independent work concurrently with bounded fan-out and an intentional partial-failure policy. Preserve timeouts, cancellation, response-size limits, retry budgets and rate-limit backoff.

Paginate or otherwise bound expensive responses. Streaming and background jobs are options when the workload benefits, not defaults for every endpoint. Keep job status, retries and idempotency observable.

Preserve ownership checks and failure semantics. A cache or fallback must not turn an error into fabricated success or silently return another tenant's data.

Verify representative success, timeout, cancellation, overload and dependency-failure paths with the project's test/runtime tools. Respect the actual hosting model; add pools, queues or load balancers only for a justified requirement.
