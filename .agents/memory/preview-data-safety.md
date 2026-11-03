---
name: Preview data safety
description: Production-backed preview, additive changes and safe local verification boundaries.
---

Oldtime is live. Preserve current accounts, posts and other user records; the earlier fresh-launch reset was a one-time migration, not ongoing permission to clear data.

**Why:** the user explicitly requires the operational site and completed work to remain intact.

**How to apply:** incremental Places and Status schema changes are additive only. Do not run historical resets, imports, cleanup or destructive migrations without a new explicit request.

The default preview uses the existing production Cloudflare data. Current-source Places handlers can run in the development gateway without publishing, while other APIs remain relayed to the existing site.

**Why:** frontend-only updates left preview calling older live handlers, producing misleading missing-post/place errors even though local fixture tests passed.

**How to apply:** distinguish current source, running preview and published code. Never switch the user's whole preview to an empty fixture database. Browser mutations must explicitly route every API/media request to an isolated local backend; do not create test users/content in production. A public-data read check is not evidence of a signed-in production browser check.

For critical native-account UI checks, prefer a separately isolated local Cloudflare Worker with local D1/R2 over fabricating a complete signed-in account-state response. Keep the ordinary preview gateway unchanged and prevent test WebSockets from reaching the live service.

**Why:** handwritten cloud-session fixtures repeatedly stalled account-state hydration and confused browser media failures with application failures. The isolated native runtime allowed actual sign-in, privacy writes, uploads and video playback without live mutations.

**How to apply:** assert account-state hydration before testing protected screens. Use valid media posts for Home fixtures: ordinary text posts belong to Community and are intentionally excluded from Home. Clean up temporary local credentials and storage afterward.
