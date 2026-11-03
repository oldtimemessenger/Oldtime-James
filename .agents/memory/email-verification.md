---
name: Email verification policy
description: User-approved handling for changing an account's sign-in email.
---

Use Resend for Oldtime email verification. The `heyoldtime.com` sender domain is verified in Resend with Resend Forge enabled and Cloudflare selected as provider. Do not switch back to Amazon SES without a new user request.

Do not persist a new sign-in email until the user explicitly starts verification. Keep the current sign-in email active until the new address has been verified. For accounts with an explicitly unverified current email, the user wants an occasional, dismissible “Verify your email” card in the Home feed instead of a standing explanation under the profile email field. Do not show it when verification status is unknown or when the account is verified.

Signup and ordinary app use do not require email verification. Reminders must stay subtle and optional, with dismissal/snooze and a way to stop them; requesting an email is always an explicit user action.

**Why:** The user explicitly confirmed optional signup and asked for occasional, non-annoying verification cards rather than a blocking signup gate.

**How to apply:** Keep unknown legacy verification history distinct from explicitly unverified new accounts. Do not invent a verified or unverified history, conflate email confirmation with Blue Badge, send mail automatically, or replace the existing authentication system.

**Why:** the user chose Resend and supplied proof that the sender domain is verified. They want the profile editor kept clean, prefer a periodic feed reminder, and require the current sign-in address to remain usable until the new address is verified.

**How to apply:** profile edits may hold an email as a temporary form draft, but account-state and profile saves must not store or switch to it before verification completes. Keep Resend credentials only in Cloudflare Worker secrets; never ask the user to paste an API key into chat. Show the Home reminder only when the server explicitly reports the current address as unverified.

## Official-account email claim links

Allow the literal `Origin: null` for high-entropy, single-use email-link confirmation forms, including the official-account claim, while continuing to reject concrete origins outside Oldtime and preserving token expiry, one-time use, and size checks.

**Why:** the user opened the real confirmation email on iPhone but received the Worker’s invalid-request page. Cloudflare had no request-level telemetry to confirm which header triggered the guard, so opaque-origin support was added as a narrowly scoped email-webview compatibility fix and covered by a regression test.

**How to apply:** keep this exception limited to high-entropy bearer-link confirmations; do not extend it to cookie-authenticated state changes. If the flow still fails, add privacy-safe request diagnostics before loosening validation further.

## Verification state across authentication entry points

Preserve explicit unverified, confirmed and unknown history consistently during fresh sign-in as well as subsequent account refreshes. Saved list-privacy preferences must also survive fresh sign-in.

**Why:** checking only registration and account status missed a fresh-sign-in projection that turned a known-unverified account into unknown, silently suppressing the optional feed reminder.

**How to apply:** exercise the actual sign-in response when adding private account flags; sharing a response serializer does not ensure that every database projection supplies those flags.
