---
name: Cloudflare hosting
description: Cloudflare destination architecture, cost limits, and safe migration boundary.
---

The user approved moving Oldtime fully to Cloudflare Pages, Workers, D1, and R2, targeting the $5/month Workers Paid minimum plus usage. The original fresh-launch reset and refusal of legacy imports were one-time migration decisions, not permission to clear current live records. Preserve today's accounts and content; see preview-data-safety.md. The user wants no alternative-provider dependency, credential request, fallback, or parallel backend in the running Oldtime app.

**Why:** The user chose Cloudflare for the complete stack, set a budget target, clarified that the app starts fresh without a backup, and repeated that the retired backend must be removed.

**How to apply:** Keep native D1 queries and additive migrations. Do not resume the historical reset or deferred cleanup without a new explicit request. Do not request or add alternative-provider credentials, wipe unrelated projects, or erase Cloudflare migration history. Preserve the reserved @oldtime identity. Do not promise zero total cost; service quotas and overages are separate. Do not change DNS or publish without approval.

Keep API and media links under the site's own origin; do not ask the user to find or invent a separate production API URL.

**Why:** Same-origin access avoids extra DNS/API-address setup and cross-origin complexity for the fresh Cloudflare launch.

**How to apply:** Use the Pages-to-Worker service binding and preserve the original request context. Keep the Worker private and do not add an alternative-host fallback.

The isolated Cloudflare verification D1 database can lag the current Worker schema. Check its applied migrations before testing authenticated routes; do not assume it matches the production database.

**Why:** An authenticated media upload test required a temporary test-only column because the verification database had not received the current auth schema.

**How to apply:** Keep verification Worker bindings isolated, request approval before schema writes, and remove test records and temporary schema changes after the test. Never apply a test schema adjustment to production.

The fresh-launch browser reset must run only once after Cloudflare confirms its launch marker. Do not change that marker during ordinary releases, and clear only Oldtime-namespaced device storage.

**Why:** The user authorized a fresh launch, not repeated deletion of future accounts, drafts, or other artifacts' browser data.

**How to apply:** Preserve the completed-reset marker across releases; disable automatic legacy imports rather than bringing old device data into new accounts.

The user insists that Cloudflare is the source of truth for live account profiles, avatar/cover references, posts, and uploaded media. A workspace preview or browser cache is not the product and must not override Cloudflare profile data.

**Why:** the user repeated that Oldtime must operate through Cloudflare and objected when browser-local state was described as the live source.

**How to apply:** Use the same-origin Cloudflare API and its authorized media URLs for profile and post assets. Cloudflare responses win over stale device profiles; local previews and regression fixtures are not production verification. Clearly distinguish prepared changes from released changes and obtain release approval before publishing.

Oldtime is now live with real users and data. Cloudflare is its production runtime and persistent storage; Replit is the code editor, not an alternate source of user data. The earlier fresh-launch permission must never be reused to reset current users.

**Why:** the user repeated that this is a live app, not a demo, and objected to describing device or workspace state as their production app.

**How to apply:** Preserve current Cloudflare records. Never seed fake accounts or posts into production for verification. Code checks must stay isolated from live writes, and their results must not be presented as successful production or physical-iPhone verification.

When the workspace is ahead of the active Cloudflare release, deploy only from the active production baseline plus the explicitly approved changes; do not publish the entire workspace checkout.

**Why:** The workspace included unrelated commits newer than the live Pages release, so building from its current head would have released changes outside the user's approval.

**How to apply:** Check the latest Pages and Worker versions before deployment, isolate the matching production baseline, build and test there, and label the deployment to reflect that baseline and the approved patch.

Pages deployment metadata can identify an older source commit while the active browser assets include separately approved release overlays. Match the public asset fingerprint to an isolated rebuild before layering in a new release.

**Why:** The latest Pages commit label did not by itself describe the deployed client bundle; matching the live entry and main-script fingerprints established the safe release baseline.

**How to apply:** When the commit label and active assets disagree, reproduce the active bundle before publishing. Do not use commit metadata alone to justify replacing production assets.

If environment protection blocks creating a temporary Git worktree for that comparison, build from a read-only `git archive` of the Pages source commit instead.

**Why:** Git worktree metadata changes can be rejected by the workspace guard, while an archived source snapshot reproduced the active Pages bundle without changing repository metadata.

**How to apply:** Archive the exact Pages commit into a temporary directory, build there, and compare the entry, main JavaScript, and CSS hashes with production before applying the approved patch.

For a narrowly scoped CSS-only hotfix, if the live JavaScript cannot be reproduced safely from the available source, preserve the current Pages asset set byte-for-byte and add a separately versioned stylesheet. Keep the existing Pages function and service binding in the deployment.

**Why:** A clean build changed the live asset fingerprints; the static overlay let the visual fix ship without replacing active client code or the Cloudflare API path.

**How to apply:** Verify the original app JavaScript hash, the hotfix stylesheet, and `/api/healthz` on a preview before publishing. Never use this as a reason to mirror or replace production data.

Current Cloudflare records show both `heyoldtime.com` and `www.heyoldtime.com` active on the `oldtimehive` Pages project; the apex CNAME is unproxied and `www` is proxied. Re-check live records before each release and do not alter DNS.

**Why:** The live Cloudflare API now reports both hostnames active and mapped to Pages, superseding the older root-domain routing note.

**How to apply:** A production Pages deployment updates the app served on both current hostnames. Treat that separately from DNS changes, preserve both records, and obtain explicit approval before modifying routing or certificates.
