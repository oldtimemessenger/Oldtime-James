---
name: Cost-controlled media
description: Product priority for keeping Oldtime's media, messaging, and call infrastructure affordable and predictable.
---

Build and operate every Oldtime feature with low, predictable infrastructure cost in mind, not just media. Look for savings across requests, storage, transfer, compute, retention, and fan-out. Preserve privacy, reliability, and content quality, and do not claim a percentage saved without measurement.

**Why:** The user explicitly asked that all of Oldtime be built with savings in mind.

**How to apply:** Estimate the high-volume path before implementation; prefer bounded requests, lazy loading, caching with correct authorization, batching, retention cleanup, and direct one-to-one calls where appropriate. Do not add metered TURN relays, SFUs, or other bandwidth-heavy services without explicit budget guardrails. Explain that a hard spend cap can restrict service at quota before enabling billing controls.

## Startup and offline asset loading

Precache only the app shell and its static dependency closure. Load large feature bundles on demand, then cache only content-hashed assets in a bounded runtime cache. Never cache API, authentication, or user-specific media responses.

**Why:** Mobile users should not download or store features they have not opened, while private account data must not persist in a shared cache.

**How to apply:** Keep maps, analytics, editors, and media-processing libraries out of the shell precache unless they are required for startup. Preserve the size bound and API/auth/media exclusions when changing service-worker caching.

## Private media cache lifetime

Keep a private object's browser cache lifetime no longer than its access URL lifetime. Some CDNs can retain cached responses independently of token expiry. Reuse an access URL only while the viewer remains authorized; do not make private media public just to improve cache hits.

**Why:** Token expiry and cache TTL are independent; a cached response can otherwise remain usable longer than intended.

**How to apply:** When changing signed URL expiry, update the media cache-control value in lockstep and verify private media cannot remain accessible from a stale CDN cache longer than intended.

## Video upload format

For future video uploads, cap resolution at 1080p and preserve the source frame rate up to 60 fps. Keep compatible originals when browser encoding would reduce quality or frame rate; downscale only above 1080p, and fail clearly if a required conversion cannot be done acceptably. Initial variable-quality bitrate ranges are 2.5–4 Mbps for 720p and 4–6 Mbps for 1080p at 30 fps, adjusted upward for 60 fps and complex motion. Keep current Cloudflare delivery; defer adaptive-bitrate renditions and server-side transcoding.

**Why:** The user explicitly chose 1080p as the future-upload maximum to preserve sharp motion without uncontrolled storage and bandwidth costs.

**How to apply:** Apply this only to future uploads. Verify actual output dimensions, frame rate, duration, audio synchronization, bitrate, and playback; keep poster/thumbnail generation separate from the playback file. Do not modify existing uploads or add duplicate renditions without approval.

## Distinguish storage cleanup from bandwidth limits

Treat stored bytes, cached egress and uncached egress as separate budgets. Deleting stored files does not reverse bandwidth already consumed. Do not promise that smaller storage usage or better CDN caching resolves a cached-egress warning.

**Why:** A request to reduce Storage usage was followed by a provider notice identifying cached egress as the actual exceeded resource.

**How to apply:** Confirm the warning's resource and billing cycle before proposing a remedy. Keep cleanup proposals separate from traffic reductions, require explicit approval of exact deletion candidates, and check current provider documentation rather than preserving quota numbers in memory.

For media cleanup, delete confirmed objects through the storage API before deleting their database owners. If object deletion is blocked, preserve the database references and stop rather than leaving orphaned files.

**Why:** Deleting database metadata does not remove underlying stored bytes; a blocked object deletion must not be bypassed this way.

**How to apply:** Match each approved media key to its owning test record, remove it through Storage API, verify the object is gone, then delete the account and its cascading records.

## Budget the verification traffic

Use metadata for the initial cleanup audit. Downloading candidates and retained copies for independent checksum verification also consumes egress; disclose that estimated traffic before an approved destructive cleanup.

**Why:** A checksum check is read-only but still downloads complete files, which matters during a bandwidth-quota incident.

**How to apply:** Verify only approved candidates and necessary retained copies, avoid repeat downloads when a valid checksum check remains current, and record verification bytes separately from bytes freed.

## Cloudflare R2 incomplete-upload lifecycle

The live `oldtime-media` bucket has an enabled 48-hour rule for aborting incomplete multipart uploads, alongside Cloudflare's enabled 7-day default. These rules apply to unfinished multipart uploads, not completed posts or media.

**Why:** The connected Cloudflare account was checked directly; incomplete uploads already have a bucket-level safety net.

**How to apply:** Keep completed-media retention separate from multipart-abort rules. Do not add broad object-expiration rules or change the existing lifecycle without explicit approval.
