---
name: architecture-discovery
description: "Inspect WatchLedger architecture when onboarding, planning a cross-layer change, or updating the project context."
---

# Architecture Discovery

Read PROJECT_CONTEXT.md, then verify the affected paths against the current checkout. Start with package.json, app/page.tsx, app/api/, lib/, db/ and .openai/hosting.json. Treat PROJECT-NOTES.md as historical until verified.

Trace one actual flow from UI through route, validation, collector/archive and storage. Distinguish public catalog/market data from owner-scoped custom watches and records. Record file evidence and unknowns in PROJECT_CONTEXT.md.

For an audit, use DEVELOPMENT_AUDIT.md: separate demonstrated defects, static risks and unmeasured performance hypotheses. Inspect callers before proposing changes. Do not treat the shared chat's generic recommendations as repository findings.

Verify referenced files exist and relevant tests are executable. Discovery itself does not authorize unrelated behavior changes, data migrations or external publication.

Project evidence: [PROJECT_CONTEXT.md](../../../PROJECT_CONTEXT.md).
