---
name: API error responses must never include detail
description: How to find and eliminate leaked internal error info (SQL/stack/third-party bodies) in JSON error responses
---

Common places raw internal error info leaks into a client-facing JSON error body, beyond the obvious `catch (e) { res.json({ error: String(e) }) }`:

1. **Dev-mode branches**: helper functions like `function safeError(e) { if (NODE_ENV === "development") return String(e); return "generic" }` still leak in dev, and dev/prod parity bugs mean this pattern is risky — just always return the generic message and log the real error server-side instead.
2. **Third-party API passthrough**: routes that proxy external APIs (Shopify, Google Ads, Meta, etc.) often do `if (!r.ok) { const body = await r.text(); res.status(r.status).json({ error: "X API error", detail: body }) }`. The `detail` here is a raw external API response body — treat it the same as an internal leak and log it via `req.log.error` instead of sending it to the client.

**Why:** Error message text can contain schema/table names, query fragments, or account/config details that help an attacker or just shouldn't be user-facing. A generic client message + structured server log (`req.log.error({ err }, "message")`) satisfies both observability and security.

**How to apply:** When asked to prevent error detail leakage, grep the whole server for `String(e)`, `.stack`, `detail:`, and `console.(error|log|warn)` — not just the specific route file mentioned in the task. Leaks and non-structured logging tend to be scattered across many route files with the same copy-pasted pattern.
