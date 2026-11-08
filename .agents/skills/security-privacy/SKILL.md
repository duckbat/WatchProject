---
name: security-privacy
description: "Review WatchLedger authorization, external fetching, input boundaries and secrets when changing those surfaces or investigating a security issue."
---

# Security Privacy

Inspect app/chatgpt-auth.ts, app/api/records/route.ts, market/live and market/refresh, plus collector safeFetch. Verify authorization at the server boundary rather than trusting UI restrictions.

Preserve owner constraints on custom models and personal records. The public-catalog service refresh relies on an owner-private Sites gateway: re-evaluate that boundary before any audience/access change.

Validate untrusted data with existing Zod schemas and provider URL/origin checks. Keep user-submitted marketplace URLs out of automatic fetches. Enforce body/response and pagination limits at the actual trust boundary, not only in a UI.

Keep credentials server-side and out of source, command arguments, logs and fixtures. Follow the supported hosting credential workflow when publishing; a skill never grants extra access or approval.

Verify cross-owner rejection, malformed inputs, unsafe URLs and provider failures for the changed path. Fixtures should contain watch facts, not seller contacts. Do not bypass CAPTCHA or source access controls to fill a price gap.

Project evidence: [PROJECT_CONTEXT.md](../../../PROJECT_CONTEXT.md).
