# Current validation — 2026-10-09 (America/New_York)

## Verdict

**Not finished and not approved for real-user launch.** This is a repair milestone,
not a replacement for the outstanding work in `production-readiness.md`.

The existing app was imported from `oldtimemessenger/OldtimeAws`, retaining its
design, creative tools, backend and portable AWS adapters. No source repository
commit, push, pull request, production deployment, or AWS change was made.
The schema was applied only to this initially empty development database.
Existing production accounts and data were not imported, migrated, or deleted.

## Changes pending the owner's review

1. **Renewable sessions:** unrelated registrations and password logins no longer
   delete expired Cognito access sessions that still have a valid refresh grant.
   Unrenewable expired sessions are still cleaned up.
2. **Online text-post deletion:** owners have a confirmed Delete action in the
   feed. Failure preserves the post; account-switch responses cannot modify a
   different user's state. Confirmed deletions stay removed even if a stale feed
   response arrives. An imported local original is removed only after server
   confirmation to prevent automatic re-import. This does **not** complete
   local photo/video/story deletion or server account deletion.
3. **Installable build assets:** production emits a stable manifest, both install
   icons, and a service worker using actual bundled filenames. The worker never
   caches authenticated requests, API responses, writes or arbitrary media.
   Worker updates wait rather than forcibly interrupting an active edit.

## Evidence collected here

- Full workspace type checks and production build passed.
- API suite: 40 tests passed using the development database.
- Frontend non-browser suite: 144 tests passed before the PWA change; the added
  worker cache-boundary test also passed individually (145 total tests).
- New HTTP/database integration coverage uses independent disposable accounts:
  register; create a post; read it as another account; idempotent likes; persisted
  comments; rejection of other users' deletes; owner deletion; cascading removal
  of likes/comments; post absence for another account; session cleanup behavior.
  Test fixtures are removed by their own IDs.
- New frontend request tests cover successful/failed deletion, ownership, delayed
  responses after switching accounts, imported-original removal, and stale feeds.
- Production PWA output verified: stable manifest URL, both referenced icons,
  worker emission and existence of every generated precache file.
- `pnpm audit --prod`: no known vulnerabilities reported at the time of this check.
  This is not a comprehensive security audit.
- API health returned HTTP 200; frontend and API services started successfully.
- Public mobile sign-in screen rendered at 402×874 with no reported browser error.
  Signed-in UI interactions, the new delete button, physical-device installation,
  offline/update behavior and real Cognito login were **not browser-verified**.
- Large frontend bundle warnings remain.

## Still required before launch

- Server-backed relationships, audiences and blocking applied consistently to
  every read, mutation, share and media-delivery path.
- Cross-device messages, notifications and call signaling; delivery and failure
  states must reflect actual remote delivery rather than local writes.
- Shared media-post/story/community persistence and full content lifecycle.
- Complete server account deletion, account recovery and email verification.
- Moderation queue, administrative authorization, reporting and abuse operations.
- Existing AWS Cognito/S3/database configuration and live integration tests,
  private object access, backup/restore, monitoring and load/rate-limit checks.
- Payment/store verification if paid features are part of launch.
- Legal/support details, age policy, retention and operational ownership.
- Signed-in browser journeys and real iOS/Android checks.

## Configuration distinction

This project currently has a development PostgreSQL connection. It does not have
the app's Cognito client/pool or S3 bucket/IAM configuration. The pool values and
old development callback in `cognito-configuration.md` are inherited documentation,
not validated current configuration. Do not enable Cognito with a guessed client
ID or reuse that old callback automatically. Keep working password sign-in until
the intended provider transition is configured and tested.
