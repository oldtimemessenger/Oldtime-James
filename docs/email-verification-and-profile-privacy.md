# Email verification and profile list privacy

## Audit and retained infrastructure

Oldtime uses its existing Cloudflare Worker and D1 accounts, passwords and opaque sessions. Ordinary registration remains available without email confirmation. The reserved official-account claim retains its existing confirmation requirement.

The existing transactional sender is Resend, with `RESEND_API_KEY` stored as a Worker secret and the existing `Oldtime <verify@heyoldtime.com>` identity. No new mail provider, sender address, DNS records or authentication system was introduced. Secret-name presence was checked without reading its value. Actual current provider-domain status and inbox delivery were not tested.

Existing email-change tokens are 32 cryptographically random bytes, hashed with SHA-256, valid for 30 minutes, and consumed only after an explicit form POST. Existing paths and token format are retained. Read-only requests to the existing confirmation path on both production hostnames returned the expected invalid-link page for a deliberately invalid token.

There is no `artifacts/old-time-mobile` project in this workspace. This change adds no app scheme, entitlements or native rebuild; confirmation opens in the browser, and the web client refreshes status when the user returns.

## Changes

- A separate current-address verification flow does not overwrite or cancel pending address changes.
- Existing accounts with unknown verification history stay unknown. New registrations are explicitly unverified. Neither state blocks normal signup or use.
- Verification requires a valid, unexpired, address-bound token and a POST. GET requests and email scanners do not consume it. Replays fail.
- Requests require authentication, a per-account resend cooldown and the existing outer request limit. Failed delivery does not claim success or mark an account verified.
- Signup, address-change and official-claim mail share white, inline-Arial templates with concise copy, a primary button, visible fallback URL, plain text and a dynamic-year footer. User-controlled content is HTML-escaped.
- Native email webviews with an opaque origin can confirm a valid bearer link; unrelated concrete origins remain rejected. This exception does not apply to authenticated account-setting writes.
- The Home reminder is inline, not an automatic modal. It waits at least 24 hours plus a stable per-account offset and is capped at once per seven days. It respects cloud pause/snooze/stop preferences and never sends mail on mount or dismissal.
- Manual confirmation remains reachable from Settings and a compact Edit-profile action without discarding unsaved edits. Email confirmation is not Blue Badge.
- Followers are hidden from other people by default; following is visible. Owners always retain both lists. New server-backed list endpoints enforce these choices, private accounts and blocks. Counts remain visible, but hidden-list preview photos do not leak.

## Schema and release boundary

`0031_account_email_and_list_privacy.sql` is additive: verification tracking, visibility flags and a hashed-token table. Existing user and content records are not removed or replaced. Apply it before releasing the corresponding Worker and Pages code.

Unit tests use in-memory SQLite with the actual migrations and injected mail delivery. Browser checks intercept all API calls and use synthetic accounts and media. Neither is proof of real inbox delivery or a live application release. Record migration, Worker and Pages outcomes separately.

## Verification results

- All 129 backend tests, API/library type checks, Worker dry-run build and frontend release build passed.
- All 37 final focused UI/policy tests passed, including reminder mounting, node retention, dismissal, disconnected renders and busy/unknown-account suppression. A broader frontend selection had eight legacy authentication-fixture failures in saved-sound/remix tests; this is not a claim that the full repository suite is green.
- Approved migrations through `0031` were applied to the existing remote D1 database. The check afterward still showed 18 users and 50 posts. Legacy verification history remained unknown rather than being reset to unverified.
- Protected browser checks used a separate local Worker with local D1/R2 and actual native sign-in. Privacy values survived reload, owners retained list access, and hidden visitor followers returned 403 without preview photos.
- Opening and closing the manual email sheet did not send mail or discard the unsaved profile bio. One explicit Send produced exactly one local request; absent provider configuration yielded a clear retryable error. No real email was sent.
- Studio loaded with no automatically attached sound or discovery request. The manual picker remained available and fit at 320px and 390px.
- An actual local video upload and post succeeded. Its viewer decoded and advanced playback, without horizontal overflow at either tested width.
- A follow from the native profile list succeeded and retained the sheet with its confirmed Following label at both mobile widths.
- The browser found that the inline reminder was missing. Fresh sign-in omitted the private verification/list flags even though the account-status endpoint returned them. The sign-in projection was corrected and regression-tested for unverified, verified and unknown accounts plus saved privacy preferences. An actual isolated native sign-in then returned the expected explicit unverified status. Managed feed slots now retain the card through data refreshes; a detached render never consumes the weekly reminder. These final corrections have automated checks but have not had another browser pass.

The Worker and Pages application code has not been published. Database migration success and local verification must not be described as a live release. Real inbox delivery and physical iOS/Android behavior remain unconfirmed.

Temporary local test credentials, D1/R2 state and the isolated test server were removed after verification. The normal preview gateway and live user records were not switched to that test database.

## Existing Cloudflare release commands

Run from the workspace root after reviewing the pending changes. The production frontend build has already been generated:

```sh
pnpm --filter @workspace/api-server exec wrangler deploy --config wrangler.toml
pnpm exec wrangler pages deploy dist/public --project-name oldtimehive
```

Publish the Worker before Pages so the new frontend does not call missing account or Discovery endpoints. These commands were documented, not executed.
