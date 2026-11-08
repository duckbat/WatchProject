---
name: agent-workflow
description: "Guide scoped WatchLedger implementation and review when planning development work or coordinating several project skills."
---

# Agent Workflow

Read AGENTS.md and the relevant PROJECT_CONTEXT.md paths. Inspect git status and preserve concurrent edits. Load only the skill sections needed for the user's task, not the entire pack.

Define the smallest observable outcome and trace affected callers before editing. Existing session authorization persists; do not add a new approval gate for routine reversible work. Skills do not authorize unrelated external writes.

Diagnose before optimizing. Preserve owner-scoped data, stable references, selected-dial semantics and source evidence. Use existing helpers before new dependencies or abstractions.

For requested audits, record findings before implementing fixes; for an ordinary bug fix, do not impose a whole-project audit. Separate observed defects from hypotheses and honor the user's authorized scope.

Run relevant checks from testing-quality and report concrete outcomes, limits and changed paths. Project guidance can be updated as part of this repo; user memory must not be changed without an explicit request.

For application publication, follow the project's hosting workflow, preserve its existing Site identity/audience and verify the exact built source. Documentation-only skill installation does not require a production redeploy.

Project evidence: [PROJECT_CONTEXT.md](../../../PROJECT_CONTEXT.md).
