# Oldtime mobile

Expo wrapper for the existing Cloudflare-hosted Oldtime website. The website,
Worker, D1, and R2 remain authoritative. This package does not create another
database, copy browser sessions, migrate users, or replace the website.

The production website URL is the public `expo.extra.oldtimeUrl` setting in
`app.json`. Do not put credentials in that setting. Sessions remain inside the
device WebView and are not sent to a native JavaScript bridge.

## Development

From the workspace, run the managed **Oldtime Mobile** workflow. Open
**Preview on your phone** and follow the managed Expo Go sign-in instructions.
Web preview embeds the live website; camera and microphone behavior in a
cross-origin browser preview is not proof of native device behavior.

The original Oldtime icon, colors, screens, and navigation are preserved.
There is deliberately no second native bottom navigation.

## Checks

```sh
pnpm --filter @workspace/oldtime-mobile run typecheck
node --test artifacts/oldtime-mobile/test/*.test.mjs
```

Before a store release, verify on physical iOS and Android devices:

- Sign in, restart, sign out, and switch accounts without session leakage.
- Pick mixed photos/videos, capture a photo/video, record a voice note, and
  grant/deny/re-enable the relevant permissions.
- Publish a Status with original sticker artwork and answer a private question.
- Check video sound, fullscreen playback, text keyboard, home indicator,
  Android back navigation, external links, and offline/retry behavior.
- Check downloads and sharing. Native file downloads open the browser with an
  explicit warning that a separate browser sign-in may be needed; blob-based
  exports and browser Web Share APIs require separate on-device verification.

No native notification bridge or background upload service is added. Website
features keep their existing behavior and limitations. A wrapper is not a
guarantee of store approval: native utility, privacy disclosures, signing,
developer-account setup, and store review still apply.

Replit Expo Launch handles iOS production builds and App Store submission when
the user starts publishing. Google Play submission is not supported by that
flow. This source package is not an IPA, APK, AAB, or a signed store build.
