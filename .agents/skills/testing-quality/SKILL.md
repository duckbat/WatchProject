---
name: testing-quality
description: "Select meaningful checks and test evidence when implementing or reviewing a code change."
---

# Testing Quality

Discover the repository's actual test runner, language tools, build commands, fixtures and runtime requirements. Reuse existing helpers; do not assume a particular package manager, command or framework.

Choose checks by the behavior and callers affected. Add a small meaningful test for new parsing, money, security, state-transition or other consequential logic. Test observable invariants and edge cases rather than copying implementation structure.

Keep pure tests independent of unavailable platform bindings. Use integration tests for persistence, authentication and concurrency, and browser/device checks for UI behavior when those boundaries matter.

Inspect smoke-test setup before running it: use disposable identities/data for mutations and avoid unintended external side effects. Preserve useful existing fixtures and keep private information out of new fixtures.

Run the required focused checks after final relevant edits. Broaden testing when failures or unresolved risks justify it; do not impose a full suite for an unrelated documentation change.

Report what actually ran, the environment and material gaps. A passing typecheck, mock, build or fixture does not substitute for live/runtime evidence.
