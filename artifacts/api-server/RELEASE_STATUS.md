# Oldtime release checkpoint — 2026-10-31

## Verified code, not a completed live release

The existing live app has not been replaced. No production migration, Worker publication, Pages publication, DNS change, data import or reset was performed.

### Video export

The timestamped encoder is lazy loaded. It encodes explicit frame times rather than assuming canvas rendering keeps up with wall-clock recording. Healthy progress renews the stall watchdog. Cancellation disposes input and output resources. The editor's tap-started audio graph is retained for preview and retries.

An independently probed source contained 60 VP8 frames and 101 Opus audio packets over 2.008 seconds. Browser verification exercised the actual Studio import, audio controls, Ledger filter at full intensity, and Download action without publishing a post.

- Muted: complete H.264 export, 121 video frames, approximately two seconds, no audio track. Decoded image was grayscale and nonblank.
- Original audio: complete H.264/Opus MP4 export, 121 video frames, 2.0135-second container duration, 101 audio packets, audio RMS 0.12446. Decoded image had zero RGB channel difference, 220 luminance values, and approximately 84% nonblack pixels.
- No page exceptions occurred. The isolated harness blocked live write requests; its HMR/realtime blocking diagnostics are not production failures.
- This is Chromium evidence, not physical iPhone/Android verification or proof of a live R2 publication.

### Other verification

- All 624 non-browser frontend tests passed.
- The eight previously failing backend fixture files passed their focused reruns after supplying the required signup interests and correcting the outdated expectation that an unfollowed account appears in Following.
- Frontend build and type checks passed.
- Worker TypeScript check and Wrangler deployment dry run passed. The dry run did not publish.
- Managed frontend and API gateway workflows restarted successfully. Public sign-in screen rendered without browser errors.
- The broad navigation browser check stopped at an obsolete text-label assertion for the now icon-only Community compose button. That assertion was updated; the broad browser run was not repeated.

## Required Cloudflare release order

Read-only remote migration inspection showed these pending migrations:

1. `0024_community_feed_controls.sql`
2. `0025_story_archive_policy.sql`

Apply them to the existing D1 database, then publish the existing Worker with the current DB/R2/Realtime bindings, then publish the current frontend to the existing Pages project. Preserve current root/www routing and DNS.

The second migration is required by story creation and private archive queries, not just the archive screen.

After publication, verify authenticated Community preferences and all four feeds, private saved/library endpoints, story creation/archive, and an explicitly authorized test post's upload and playback. Do not use real customer content or create duplicate posts as a test.

## Limits of this checkpoint

This document does not certify an App Store review, a legal/privacy audit, every earlier requested redesign, native-device compatibility, or a successful production release. The new Community and private library endpoints cannot be declared live until the prepared Worker and database changes are actually released.
