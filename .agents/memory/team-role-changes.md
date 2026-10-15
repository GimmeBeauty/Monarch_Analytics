---
name: Team role changes
description: Owner-managed member roles and authorization freshness expectations.
---

The owner must be able to change existing members between Admin and User after they have joined Monarch. Do not treat the invitation-time role as permanent or require deletion/re-invitation to change it. Ownership transfer is outside this feature.

**Why:** The user explicitly requested post-addition role changes. Existing signed-in sessions must not preserve revoked administrative privileges after demotion.

**How to apply:** Keep owner-only role editing and owner-account protection intact when changing team management. Any authorization/session optimization must preserve immediate server-side permission changes for existing sessions, rather than trusting an old role claim until the member logs in again.
