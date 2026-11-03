---
name: Publication confirmation
description: Server-confirmed content must survive later refresh or display failures.
---

A confirmed successful publication must never be deleted as compensation for a later feed-refresh or display failure. Do not label that outcome “nothing was published” or offer another publication as its retry.

**Why:** A Story could be saved successfully, then deleted when its subsequent feed refresh failed. This risks removing real content and creating duplicates when the creator retries.

**How to apply:** Treat the creation response as authoritative, cache the confirmed content, and distinguish saved-but-not-refreshed warnings from actual upload or creation failures. Keep this boundary consistent across Posts and Stories.
