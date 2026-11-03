---
name: API contract synchronization
description: Preserve supported API behavior when regenerating clients and validators.
---

Keep existing runtime contract extensions in OpenAPI before regenerating validators or clients; do not rely on hand edits in generated files.

**Why:** Earlier generated validators contained feed-surface and legacy-interaction fields that were absent from the specification. Regeneration silently removed those supported fields until the specification was corrected. Orval can also emit colliding exports for path/query validators or for an inline request-body validator and its generated TypeScript type.

**How to apply:** Compare regenerated validators against the previous contract, investigate removed fields rather than deleting backend usage, and update the canonical specification before generating again. Resolve colliding validator/type names with an explicit source-barrel re-export so the fix survives codegen; changing an operation name does not resolve an inline-body collision. Do not edit generated output.
