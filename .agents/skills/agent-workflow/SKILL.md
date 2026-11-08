---
name: agent-workflow
description: "Guide scoped implementation, investigation or review when coordinating development work and relevant skills."
---

# Agent Workflow

Read applicable project instructions and inspect the current working tree before editing. Use only skills relevant to the task. Treat existing documentation as a starting point and verify drift-prone details against current code.

Identify the requested observable outcome and affected callers. Prefer existing components, helpers and dependencies over new abstractions. Preserve unrelated or concurrent changes and the project's actual business invariants.

Diagnose before optimizing and use measurements where performance is the claim. Do not turn a small fix into an unrequested architecture audit or infrastructure project.

Apply the user's existing authorization and constraints; a skill neither grants extra permissions nor creates an additional approval gate for ordinary reversible work. Keep external writes and sensitive operations within the authorized scope.

Run appropriate checks and report the result, changed paths and material limits. Keep project guidance and personal memory distinct; do not update memory without an explicit request.

When publication is part of the task, follow the existing deployment workflow and verify the exact built source and result. Instruction/documentation-only changes do not require an unrelated application deployment.
