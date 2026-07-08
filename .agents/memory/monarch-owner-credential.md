---
name: Monarch owner login credential mismatch
description: replit.md lists a stale owner password for MONARCH; the real seeded credential lives in api-server bootstrap code.
---

`replit.md` documents the owner login as `nick@gimmebeauty.com` / `Monarch2024!`, but that is not the password actually seeded into the database.

The real bootstrap logic (in `artifacts/api-server/src/index.ts`, `bootstrap()`) inserts the owner user with `onConflictDoNothing`, using a hard-coded bcrypt hash comment-annotated with the plaintext password it corresponds to. That plaintext differs from what `replit.md` states.

**Why:** Discovered while verifying an Overview-page data fix — login with the documented password returned 401, and the real password had to be read from the bootstrap source comment to authenticate for manual API verification.

**How to apply:** If a future session needs to log in as the owner for manual/API testing and the `replit.md`-documented password fails, check `artifacts/api-server/src/index.ts`'s bootstrap insert for the actual seeded credential (in a source comment next to the bcrypt hash) rather than assuming the docs are current. Consider syncing `replit.md` to match, or vice versa, next time this area is touched — but don't print the live password into chat/logs unnecessarily.
