---
name: Patch result safety
description: Multi-file patches can partially apply despite a failure.
---
Treat multi-file patch results as non-atomic.

**Why:** The patch tool applied an independent test-file change while rejecting the accompanying implementation-file change.

**How to apply:** Inspect each file's result before retrying. Retry only failed hunks, using exact current context; do not duplicate successful additions.
