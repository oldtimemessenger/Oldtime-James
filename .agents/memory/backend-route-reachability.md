---
name: Backend route reachability
description: Why new private endpoints need entry-router and preview-gateway checks, not just handler or build checks.
---

Test new endpoints through the complete authenticated entry router and the configured preview gateway. A compiled handler alone is not evidence that the running app can reach it.

**Why:** a private library handler existed and passed the build, but its enclosing route group did not admit the URL. The preview relay also needed an explicit current-source route. This produced a misleading Not found screen despite implemented server code.

**How to apply:** keep route admission and handler registration together. Check a signed-in response and a signed-out denial with isolated local fixtures. Never use the production-backed preview to create test accounts or mutate customer records.

For publication safeguards, cover staged media-upload and edit routes as well as the final create route.

**Why:** a media-first Studio flow can be protected while a legacy “create placeholder, upload media later” path still bypasses the same check.

**How to apply:** trace each publish lifecycle from upload through create, retry and edit; ensure incomplete media records stay hidden until required checks pass.
