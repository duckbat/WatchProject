---
name: data-pipeline
description: "Implement ingestion, normalization, provenance, deduplication or refresh workflows when changing external or derived data."
---

# Data Pipeline

Trace source adapters, validation, normalization, matching, persistence and consumers before changing the pipeline. Reuse existing fetch/parse/result contracts and keep provider-specific quirks at the adapter boundary.

Define entity identity from authoritative fields. Distinguish exact identity, related records and uncertain matches; discovery/search relevance alone is not identity evidence.

Preserve raw/source amounts, units, currencies, timestamps and provenance where needed for the domain. Keep observation time distinct from event time and source facts distinct from inferred or estimated values.

Define status/evidence semantics explicitly. Missing records, unavailable inventory, counters and incomplete events must not silently become confirmed transactions. Preserve unknown values instead of inventing them.

Deduplicate with stable source identifiers or verified canonical links. Preserve history and idempotency across refreshes, schema changes and source URL changes. Keep data classes with different meanings separate in storage and downstream calculations.

Bound pages, response sizes, work and retry budgets; isolate independent provider failures. Respect configured access and communicate incomplete coverage or stale data.

Verify representative and adversarial fixtures, reclassification/merge behavior and a bounded live check when feasible. Apply the project's domain rules; generic data guidance must not invent business semantics.
