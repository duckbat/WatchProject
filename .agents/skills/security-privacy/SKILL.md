---
name: security-privacy
description: "Review authorization, untrusted inputs, external access and secret handling when changing a security-sensitive boundary or investigating a vulnerability."
---

# Security Privacy

Trace the actual trust boundary, identity source and authorization checks. Verify server-side ownership/tenant constraints rather than relying on client visibility or supplied IDs.

Validate untrusted input with the project's existing schemas and limits. For outbound fetching, assess URL/origin validation, redirects, internal-network access, body limits and timeouts according to the actual use case.

Preserve secret storage and deployment access controls. Keep credentials and private payloads out of client bundles, source, logs and fixtures. A skill does not expand permissions or authorize external disclosure.

Check existing platform protections before adding custom security mechanisms. Evaluate rate limiting, request size and retry behavior at the boundary that actually handles the bytes or work.

Verify relevant cross-user rejection, malformed/oversized input, unsafe targets and failure paths in a controlled environment. Report static concerns separately from demonstrated exploitability and state the scope of the review.
