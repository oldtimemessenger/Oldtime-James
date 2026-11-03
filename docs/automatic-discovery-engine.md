# Automatic Discovery Engine

## Reused infrastructure

Oldtime keeps its existing Cloudflare Pages frontend, Worker API, D1 database, R2 media, authentication and social relationships. Development's API server is a thin Cloudflare relay, not a second database backend.

The implementation reuses:

- Published posts, verified media metadata and media digests.
- Existing discovery documents, post/topic associations, full-text search and indexing.
- Existing account interests, privacy/block rules, relationship checks and social actions.
- Existing Search and Discover controllers, generic opened-post viewer, comment APIs and topic filters.
- Existing scheduled Worker work and additive D1 migration tooling.

No automatic accounts, artificial social activity, paid language-model classification, image recognition or video transcription are introduced.

## Additive database changes

`0029_automatic_topics.sql` adds a canonical topic registry, normalized unique aliases, topic relations, private user interests, daily deduplicated signals, bounded daily metrics, qualification policy and a moderation log. Discovery documents gain a content fingerprint and a partial pending-index index. Privacy, archive and deletion changes invalidate derived classification.

Default qualification requires three public posts, two independent creators, three distinct content fingerprints and confidence of at least 0.6. Curated seed topics can remain available before automatic candidates qualify.

`0030_profile_relationship_previews.sql` adds relationship indexes for bounded profile previews. Neither migration deletes or replaces existing accounts, posts or media.

## Backend behavior

Classification uses normalized published text and existing metadata, not mandatory hashtags. One post can match multiple reliable topics. Canonical names and aliases converge on the same reusable topic; verified media digests prevent a renamed duplicate from becoming independent qualification evidence.

Public topic evidence excludes private, archived, blocked and otherwise ineligible content. Community content remains separate from public main-feed discovery. Following requires the author to be followed; reposting does not bypass that rule.

Confirmed social actions contribute private, decaying, deduplicated topic signals. Learning respects opt-out and mute preferences and never trusts a caller-supplied actor identity. Global trending snapshots and private ordering are separate.

Topic follow, related topics, recent/popular/video/person results and moderation operations use the registry. Merges retain content and canonical redirects instead of deleting posts. New topics require database evidence, not new frontend routes or hand-created navigation sections.

Existing-post indexing is bounded and resumable. Scheduled work refreshes snapshots and prunes expired derived signals; a public request does not scan every historical post.

## Frontend behavior

Search and Discover retain their existing interface and separate helper/navigation rows. Registered topic chips are ordered by relevance and private preferences, with existing curated topics available as a fallback.

A single topic-page template handles every registered topic. Search/Discover opened media uses compact controls, real Follow/Following state and the existing comment APIs. Other requested profile, Saved, editor and Story refinements remain part of the same workspace changes, not replacement products.

## Cost and performance

- Deterministic metadata processing; no external classification API or AI usage charges.
- Indexed topic lookups, bounded candidate/result sets and batched D1 operations.
- Cached trending snapshots rather than per-request global recalculation.
- Daily actor/topic/action deduplication, decay and retention of derived signals.
- Reuse of verified R2 media rather than duplicate uploads or a second media store.
- No change to the existing Cloudflare pricing plan or DNS routing.

Large-volume load measurements and physical-device Safari evidence must not be inferred from local fixtures.

## Verification and release boundaries

The Cloudflare API suite currently passes 118 tests, including topic qualification/aliases, duplicate evidence, privacy, private signals, topic follow, moderation merge and strict Following. API type checking and generated-library type checks pass.

Browser checks use an isolated fake session with every API request intercepted: they are evidence of actual app UI wiring, not live Cloudflare mutations or delivery. They intentionally do not create public test posts or accounts.

Release order is additive D1 migrations, Worker, then Pages. A Worker dry run or a passing fixture is not a published release. Preserve live records and the existing domain routing throughout.
