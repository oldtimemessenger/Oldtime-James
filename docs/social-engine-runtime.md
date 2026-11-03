# Oldtime social engine: current runtime and launch gates

## Current operating posture

- Shared Cloudflare Worker/D1 runtime; no separate always-on service or AI agent per profile.
- The global runtime and AI generation remain disabled by default. Scheduled work only runs eligible, approved work after an administrator enables the engine. Do not turn it on in production as part of a code change.
- Seeds 10 clearly disclosed starter editorial profiles (stars, sports, African/Caribbean culture and food, fashion/weddings, North American cities, global destinations, coasts, relationships). The server registry can grow to 200 only through explicit reviewed additions.
- Place coverage is editorial subject matter, not claimed residence or lived experience. The starter themes include Miami, Montreal, Toronto, Vancouver and Paris. Use verified, rights-cleared sources for actual location-specific posts.
- Politics are excluded from this automated publisher and participation pipeline. This does not change or censor human posts.
- The selected AI generation budget is $5/month. Reservations and per-request token caps are application safeguards, not a provider-wide spending limit.

## Publication and participation rules

- Every publication retains its approved source and audit trail. Imported candidates are unverified and rights-unconfirmed until reviewed. Credit or a public URL does not establish republication rights.
- The only automated feed adapter currently implemented is a tightly bounded allowlist for NASA RSS. Other countries, cultures and categories require a verified source or an administrator-supplied, reviewed event; a global source network is not connected yet.
- Routine, eligible deterministic text can use the review/automatic mode controls. AI-generated text must be reviewed. No arbitrary scraping, media-download/repost pipeline, or licensed music/photo/video catalog is included.
- Each virtual account is a server-owned editorial profile, cannot authenticate, and has an automation disclosure in its profile. Public feeds and profile totals count actual, committed likes, comments, reposts and follows. Human accounts appear first in participant lists; lists are bounded and paginate on request.
- Virtual interactions stay separately attributable in the owner's analytics and are never used as human audience-growth signals. Automated post/profile database lookups do **not** count as public views or profile visits. Views require actual qualifying viewer events; video playback and watch time require real playback events.
- User opt-outs, blocks, privacy, account-level caps, recipient cooldowns, per-hour platform caps, revision checks and global pause are enforced server-side.

## Verification status

Verified in isolated tests before release:

- Migration and worker behavior against isolated SQLite/workerd data, with no production migrations or destructive cleanup.
- Actual action counts; 10 human plus 20 recorded virtual likes return 30, with people first in the bounded list.
- Automated interaction analytics remain separate, and do not create views, profile visits, playback sessions or watch-time records.
- Initial 10-profile seed is idempotent, disclosed and covers the stated US/Canada/world-city and African/Caribbean editorial interests.
- Political subjects, repetitive engagement bait, unauthorized media assertions, duplicate actions and stale revisions fail closed.

Not verified or not ready for launch:

- No live Cloudflare AI inference has been performed; a model catalog lookup alone is not an inference test.
- No live production migration, publishing, account seeding, post, message, media change or deployment was performed. The deferred draft-cleanup migration was not run.
- NASA feed retrieval tests use isolated fixtures. Actual endpoint availability, RSS terms and factual review must be checked independently.
- A broad set of licensed cultural, sports, entertainment and city-level feeds is not integrated. A rights-complaint and takedown workflow is still a launch requirement before automated reuse of third-party media.
- The production Pages-to-Worker route, production D1/R2 bindings, signed-in UI, origin/CSRF/CORS policy, quota alerts and rollback/restore plan must pass their own Cloudflare production checks before release.

This file is a scope/status record, not a launch certification. Keep the engine paused until these release gates are explicitly cleared.
