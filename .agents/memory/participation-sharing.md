---
name: Get On Board removal
description: Retired participation feature and preserved legacy records.
---
Get On Board has been removed from the Oldtime app and API. Preserve existing board, entry and media records, but do not expose them through app UI, active API routes or new feature behavior without a new user request.

**Why:** the user requested removal of Get On Board after earlier deciding not to delete its data.

**How to apply:** keep the data schema and retained records separate from active product behavior. Do not delete participation data or re-enable endpoints unless the user explicitly asks.
