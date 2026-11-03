# Oldtime Cognito configuration

## Architecture and current status

Oldtime uses Cognito Managed Login with OAuth authorization-code flow and S256 PKCE. The API exchanges the code and verifies Cognito ID tokens against the configured pool's issuer and public signing keys. Refresh tokens remain encrypted on the server. Existing password authentication and application account IDs are preserved.

The replacement pool's AWS discovery document returned HTTP 200 and confirmed:

- Region: `us-east-2`
- User pool: `us-east-2_LIPojnZ2W`
- Issuer: `https://cognito-idp.us-east-2.amazonaws.com/us-east-2_LIPojnZ2W`
- Domain: `https://us-east-2lipojnz2w.auth.us-east-2.amazoncognito.com`
- Authorization endpoint: domain plus `/oauth2/authorize`
- Token endpoint: domain plus `/oauth2/token`
- Sign-out endpoint: domain plus `/logout`

The new pool's public signing-key endpoint also returned HTTP 200, with two RS256 keys. This verifies public pool metadata, not the app client's settings or successful authentication.

Development configuration now references this pool and domain. The previous client ID has been removed, not reused with the replacement pool. **The new web app client ID is still required. Cognito remains disabled until configuration and live testing are complete.** Production configuration has not been changed.

## Environment variables

| Variable | Development value / requirement |
| --- | --- |
| `COGNITO_ENABLED` | Currently `false`. Set to `true` only for a controlled test after the new client is configured; do not claim readiness before testing. |
| `COGNITO_REGION` | `us-east-2` |
| `COGNITO_USER_POOL_ID` | `us-east-2_LIPojnZ2W` |
| `COGNITO_CLIENT_ID` | **Missing:** obtain the web app client's public Client ID from this new pool. Do not use the previous pool's client ID. |
| `COGNITO_DOMAIN` | `https://us-east-2lipojnz2w.auth.us-east-2.amazoncognito.com`, confirmed by AWS discovery |
| `COGNITO_REDIRECT_URIS` | `https://f39e9284-f551-4d3d-b774-795710340230-00-y7f27saism07.janeway.replit.dev/` |
| `SESSION_SECRET` | Existing server-only secret; at least 32 characters, used to encrypt refresh grants. Never expose or casually rotate it. |
| `COGNITO_CLIENT_SECRET` | Only required if the new app client has a secret. Save the new client's secret through secure secret tooling; never put it in browser code or reports. Not required for a public client without a secret. |

`COGNITO_REDIRECT_URIS` accepts a comma-separated allowlist. The browser generates its callback from its current origin and the deployed app base path, not from a hard-coded Replit URL. The same return address is currently used for hosted sign-out.

## Required AWS console checks

1. In the authorized AWS account, select **US East (Ohio), us-east-2** and open pool **us-east-2_LIPojnZ2W**.
2. Under **App clients**, select the existing client intended for Oldtime's web app. Obtain its **Client ID**; do not substitute the pool ID or client secret.
3. Check its **Login pages** settings. Authorization-code grant must be supported and `openid` and `email` must be allowed scopes. Do not enable implicit grant as a workaround.
4. For local Cognito email/password sign-in, confirm that **Cognito user pool** is an enabled identity provider. Do not add unrelated social providers.
5. In both **Allowed callback URLs** and **Allowed sign-out URLs**, include the exact development URL above, including the trailing slash. Preserve existing approved entries.
6. Inspect the domain's branding version. If it uses **Managed Login**, confirm that a branding style is assigned to this exact new app client. Do not change branding versions blindly.
7. If the client is confidential, configure its new client secret only on the API server.
8. After supplying the Client ID, retest the exact authorization request, the hosted login page, callback/state/PKCE handling, actual sign-in and sign-out. Test verification and password-recovery flows before calling them operational.

AWS administrative access is not available in this workspace. No user pool, app client, callback list, branding setting or identity provider was created or modified in AWS during this update.

## Production and account preservation

Keep development values in the development environment. Configure production separately with its approved HTTPS frontend origin/base path and matching AWS callback/sign-out entries. Do not bind production authentication to this temporary development hostname.

Replacing a user pool changes Cognito identity subjects. Existing bindings and application records must not be deleted or rewritten. Linking a new identity to an existing application account requires an authenticated existing account and a verified matching identity; email equality alone is not proof of ownership. Accounts needing recovery require a secure recovery process, not an automatic email-based merge.
