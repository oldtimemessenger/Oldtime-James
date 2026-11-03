---
name: D1 runtime portability
description: SQL compatibility limits that differ from the existing PostgreSQL backend.
---

Verify translated SQL in the actual D1/workerd runtime, not just desktop SQLite or TypeScript. Avoid large compound SELECTs and deeply repeated correlated guards; aggregate preflight counts and keep transactional predicates compact.

**Why:** D1 rejects some compound SELECTs and generated predicates with expression-depth errors, and rolls back failed batches. SQL accepted by PostgreSQL or desktop SQLite is not enough to predict D1 behavior.

**How to apply:** Bound and filter each source before fetching it; merge and paginate the results without duplicating social events into another notification store. For destructive operations, verify blockers first, use an atomic D1 batch, and confirm the full operation against D1 before publishing.

Keep migration steps in managed server startup explicitly non-interactive.

**Why:** Managed workflows can present an interactive terminal. A migration confirmation can wait indefinitely before the server opens its port, making a healthy application appear offline.

**How to apply:** Ensure new migrations cannot wait for terminal input, while retaining explicit approval for remote or destructive operations.

For production Worker releases, verify that every required D1 migration is applied before deploying code that references the new schema. A health check that only runs `SELECT 1` does not validate application columns.

**Why:** A Worker was promoted while archive queries referenced a column absent from production D1, which caused feed and profile requests to fail until the additive migration was applied.

**How to apply:** Compare repository migrations with the remote migration history, apply the intended migrations, verify the schema and that existing records remain intact, then deploy the Worker. Afterward, verify an authenticated feed request when an authorized session is available.
