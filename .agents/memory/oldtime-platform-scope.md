---
name: Oldtime platform scope
description: Keep Oldtime a PWA permanently; preserve its web product and distinguish emulated touch tests from physical devices.
---

Oldtime must remain a PWA forever: no native app and no paid video services.

**Why:** the user explicitly superseded the earlier Expo-wrapper choice with “i want to keep it pwa for ever tho” and requested low, predictable costs without paid video platforms.

**How to apply:** improve the existing Cloudflare-backed web app and on-device media processing, not Expo, Capacitor, app-store delivery or paid video hosting. Never treat Chromium mobile/touch emulation as proof of iPhone Safari or physical Android compatibility; state what was actually tested.

The canonical release artifact is Oldtime (`artifacts/oldtimehive`). Its release experience should match the current Oldtime Technologies app while preserving every option from that version. Keep Oldtime's other source available for features the user introduces later; do not treat the two artifacts as sibling products.

**Why:** the user clarified that Oldtime is the app to keep and release, with Oldtime Technologies' current appearance and options merged into it.

**How to apply:** route the release through Oldtime, preserve the Technologies release feature set, and leave Oldtime-only source intact for later ports. Do not remove either source or overwrite user data during the merge.
