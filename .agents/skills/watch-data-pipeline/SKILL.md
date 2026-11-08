---
name: watch-data-pipeline
description: "Implement WatchLedger collectors, sold-history handling, model matching and shop-price integration when changing watch market data."
---

# Watch Data Pipeline

Trace lib/collectors/services/, matching/, core/listing.ts, live.ts and lib/market-archive/. Reuse safeFetch, CollectorResult, SourceStatus and collectedPrice validation.

Search discovery may use a base reference; identity evidence must distinguish full suffix, dial, size and brand where supplied. Dedicated source identity outranks incidental description text. Keep uncertain variants out of selected-variant prices; All dials deliberately broadens the scope.

Keep asking, sold-asking and confirmed-sale distinct. A disappeared listing, closed unsold lot, estimate, bid, stock counter or unavailable shop product never proves a completed sale. A reported amount is not necessarily seller proceeds; retain source fee basis and currency.

Use retailOffers for new shop/dealer offers; keep official MSRP separate and preserve current/archived availability. The used-market and new-price paths must not contaminate each other. Original dealer URLs deduplicate syndicated ads; stable source IDs prevent domain-change duplicates.

Keep listing/sale date separate from observation/collection time. Unknown dates and seller countries stay unknown. Convert using the existing FX path and expose original amounts; currency is not seller location.

Wire new sources into the existing archive, filters/status display and unattended refresh path. Bound work and isolate failures. Consult MARKETPLACES.md for actual source access and coverage; do not promise exhaustive sold history.

Verify real and adversarial fixtures, archive retention/reclassification and one bounded live fetch when feasible. Treat a blocked source as unavailable, not as proof no watches exist.

Project evidence: [PROJECT_CONTEXT.md](../../../PROJECT_CONTEXT.md).
