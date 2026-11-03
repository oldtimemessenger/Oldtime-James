# Community controls release

This change is prepared, not published. No live data or DNS has been changed.

## Required order

1. Apply the **additive** D1 migrations `0024_community_feed_controls.sql` and `0025_story_archive_policy.sql` to the existing `oldtime-app` binding.
2. Verify the new empty tables and indexes exist. Do not import, clear or rewrite existing accounts, posts, media, follows or chats.
3. Publish the Worker to its **existing** service and bindings. Confirm authenticated Community preferences, feed and profile requests succeed.
4. Publish the frontend to the **existing** Pages project and existing root/www routing. Do not move domains or change DNS.
5. Check one dedicated test account on iOS Safari and Android: Community controls, profile Community tab, discovery playback, audio toggle and swipe/back behavior.

Do not publish the new frontend before the migration and Worker: the new Community screen requires the new endpoints.

The cloud Community page always uses the four real feeds. There is no older-server fallback, description row, compatibility notice or “Check again” button. A failed feed shows only “Couldn't load posts” with a retry inside that feed. This makes the Worker-first release order mandatory. New signup checks `/auth/signup-policy` before creating an account, so an older server cannot silently discard the chosen interests or optional follow.

New signup requires three distinct supported interests. Interest choices are stored privately as recommendation preferences, not silently added to the public profile. The visible default-selected @oldtime checkbox must send `followOldtime:true`; omitted/false consent never follows. Only the existing reserved official account is followed, atomically with account creation. Existing users are not retroactively followed or forced through onboarding.

The default Community header pins Following, Discover, Popular and Mutuals / Friends. Photos & Video and curated lists remain available to pin explicitly. Existing valid saved pin choices are preserved; reading preferences does not create or rewrite records.

## Verification already performed

- In-memory SQLite tests apply every migration and check visibility, blocks, follows, pagination, deterministic recommendations, list ownership, language labels, media-only filtering, caught-up markers, profile Community posts and authenticated message reporting.
- Type generation, shared-library type checks, Worker type check and Worker dry-run build.
- Frontend type check/build and focused UI regression tests.
- Isolated browser fixtures verified the interest minimum and disclosed follow opt-out, Search typing/flat filters/four compact previews/two-column layout, Messages inbox/search/settings/compose, and Studio photo export and docked opaque tool sheets. No production writes were made.
- Video mute and filter controls were exercised with a separately probed two-second source. The automated Download step did not complete, so encoded video duration, frame rate, filter output and muting are **not signed off**. An earlier synthetic attempt produced an incomplete file and is not counted as a successful export.
- These checks are not proof of production end-to-end behavior or physical iOS/Android behavior.

## Known scope limits

- Language filters use optional creator-declared labels; unlabelled records are never guessed from images or audio.
- Existing standalone Community posts are not conversation replies or quote posts. The hide-replies/quotes controls filter such labelled kinds; they do not hide comments inside a conversation.
- Community Discover ranks a bounded recent candidate set using chosen interests and deterministic text-topic matching. It makes no paid AI calls.
- “Hide for now” in Explore is explicitly temporary; topic feedback, Community mutes, pinned feeds, lists and reading markers are account-backed.
- Terms and Community Guidelines are labelled drafts; official business/contact details still need the owner's supplied text.
- Report receipt is not a promise of a review decision. An operational moderation workflow remains separate.
