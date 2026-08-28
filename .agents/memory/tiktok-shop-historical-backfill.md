---
name: TikTok Shop historical backfill design
description: Why the TikTok Shop backfill never infers a history boundary from error content.
---

TikTok Shop's ads reporting endpoint has no publicly documented maximum lookback or error contract for "no data exists before this date," unlike the other core channels which get full history for free from Snowflake.

**Decision:** the backfill only marks itself complete on reaching its target lookback depth. Every non-auth API error (rate limit, 5xx, network error, or any other rejection) is retried later with capped backoff and never treated as a "history exhausted" signal.

**Why:** guessing that some error shape means "no more history" risks silently and permanently stranding real historical data behind a false completion the first time an ordinary transient or unrecognized error occurs — worse than retrying forever at a low, capped frequency.

**How to apply:** if TikTok Shop's real reporting limits/error codes are ever confirmed via official docs or support, prefer switching to that documented signal over indefinite retries.
