---
name: Explore topic classification
description: Non-AI topic discovery rules for Oldtime Explore.
---

Oldtime Explore should classify some posts from ordinary words in existing content, such as captions and place labels. A hashtag must not be required.

The user confirmed that a non-AI algorithm should also connect related content and organize discoverable topics, not just return exact-word matches.

**Why:** the user wants content discoverable from its words without paying for AI or third-party classification.

**How to apply:** keep topic classification deterministic and local. Only show category filters that have matching content. Do not add AI inference, paid APIs, or hashtag-only requirements without a new request.

Do not imply that the algorithm understands image pixels or spoken audio from text metadata alone. Use real content evidence for emerging topics, and never infer sensitive personal interests from viewing behavior.
