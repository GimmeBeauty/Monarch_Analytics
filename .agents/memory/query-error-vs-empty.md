---
name: React Query error vs empty-data anti-pattern
description: Why queryFn must throw on non-ok responses instead of returning a synthetic empty/isEmpty result
---

A recurring bug pattern in dashboard-style pages using `@tanstack/react-query`: the `queryFn` catches a non-ok fetch response and returns a synthetic empty shape, e.g.:

```ts
if (!res.ok) return { channels: [], isEmpty: true };
```

This makes a real backend/API failure (auth error, DB error, upstream API down) render identically to "there's just no data for this range" — the user never sees that something broke, and there's no way to retry.

**Why:** Silent fallback to empty state hides failures from users and from monitoring; retry affordances become impossible because the query "succeeded" from React Query's point of view.

**How to apply:** In queryFn, always `throw new Error(body.error ?? \`HTTP ${res.status}\`)` on non-ok responses. Then destructure `error`, `refetch`, `isRefetching`/`isFetching` from `useQuery` and render a distinct error UI (with retry) before falling through to the loading/empty-state branches. Keep the "no data" empty state guarded with `!error &&` so the two states never render simultaneously.
