---
name: Workout sharing
description: Shared map images and videos are independent snapshots, not mutable workout posts.
---

Different image and video exports of the same workout must remain separate feed
posts. Retrying the same export may be idempotent, but publishing another export
must not replace an existing post or its attachment.

**Why:** Sharing a map image was replacing the previously shared route video in
the feed. Both representations need to remain available.

**How to apply:** Tie publishing retries to the individual export, not the whole
workout, and preserve existing attachment references when another export is shared.
