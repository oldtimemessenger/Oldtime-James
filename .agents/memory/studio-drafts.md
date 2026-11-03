---
name: Studio draft persistence
description: Persistence requirements for creative studio autosave.
---

**Rule:** Use the existing account-owned Cloudflare creative-draft service for studio autosave; do not add browser-local durable storage.

**Why:** Studio media and edits must stay attached to the signed-in account, survive device changes, and avoid importing another account’s browser data.

**How to apply:** Serialize studio state and selected media through the creative-draft service. Keep temporary editing state in memory and show a clear error if online draft saving fails.
