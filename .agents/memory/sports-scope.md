---

The app will migrate; do not rely on Replit storage for new Sports media. Preserve
access to existing uploads during the transition.

**Why:** The user explicitly said “dont rely on replits storage cause app will migrate.”

**How to apply:** Keep media references portable and require persistent storage on
the destination host. Never silently switch to ephemeral production disk.

Keep production maps and aerial replay free of paid mapping plans, subscriptions and billing-enabled
mapping/rendering APIs. Use lawful free sources outside the U.S. too, and distinguish
imagery from genuine terrain/building data.

**Why:** The user explicitly required free imagery/export and no unexpected mapping
charges, including international coverage.

**How to apply:** Verify redistribution/video rights and required credits; use honest
fallbacks. Do not promise that the app's general hosting/storage is cost-free.
name: Sports scope
description: Sports creation integrates with Oldtime; compact interactive UI and honest mobile tracking limits.
---

Sports is a non-invasive content-creation feature inside Oldtime, not a separate feed or a second fitness app. Users choose an activity, can return to the main app, and decide whether to share a workout card.

**Why:** The user explicitly said “do not build a separate feed, its like a content part then you can share it,” and requested professional, compact, interactive controls and dropdowns.

**How to apply:** Keep entry points and recording controls unobtrusive; publish into existing Oldtime content surfaces. Do not introduce a Sports social feed.

Prefer fewer, combined screens in the Sports sharing flow: open a saved workout directly to its flyover and keep animated-card and poster actions there. Put sync, GPS-gap, and extended workout information in compact details rather than making a separate stop users must pass through.

**Why:** The user explicitly said the extra saved-workout screen was unnecessary and wanted flyover and animated-card sharing together to reduce screen count.

**How to apply:** Avoid intermediate workout-detail pages when entering playback/sharing; keep essential actions visible on the flyover screen and retain secondary information in a disclosure.

Make the route-video signature a close, low-angle 3D city follow with an original red-to-hot-orange jet-flame wake behind the GPS marker. Use that 3D city flyover as the sole automatic replay/export style. Keep auto-hide start and finish visible beside route stats, on by default, and keep common create/share actions in view. Start on-screen flyover replay at 8×, with slower manual speed choices. Brand exported videos with the user's transparent red feather/stopwatch mark and a compact "Powered by Oldtime" lockup. Keep export duration independent, with a moderate automatic duration near 2× route time and manual duration controls.

**Why:** The user explicitly requested a closer cinematic flyover, one default 3D city style, an obvious automatic privacy control, 8× on-screen replay, a branded Oldtime mark on exports, and a route video faster than real time but not excessively fast.

**How to apply:** Keep camera and marker effects derived from the real active GPS segment. For flyover presentation only, estimate a connector across a plausible GPS signal loss of at most two minutes; draw it dashed and label it as estimated. Never bridge explicit pause/resume events, privacy cuts, invalid fixes, implausible jumps, or longer gaps. Exclude estimates from distance, pace, elevation, and other workout metrics. Provide reduced motion and optional video duration settings.

The user requires active workouts to keep tracking when the phone is locked, Oldtime is backgrounded, or the user switches apps. Background recording must be owned by the native location service and persist incrementally without the Sports screen; the website's geolocation API can only make a best-effort attempt. Do not claim uninterrupted recording or route coverage through GPS loss, process termination, force-quit, or a signed-out preview.

**Why:** The user clarified on October 13, 2026, that the goal is avoiding interruption when someone leaves/closes the app; browsers and mobile operating systems still constrain background tracking, and invented route segments or false continuity could hide lost data.

**How to apply:** Keep app-switching/locked-screen tracking in the native app, save GPS fixes and accuracy/speed/altitude incrementally, recover owner-scoped sessions, and clearly mark interrupted routes. Keep the web limit visible; test actual iOS and Android builds before promising device behavior. Do not fabricate routes, rankings, competitions, or tracking results.

Sports may use rich colours internally, but its main action must match Oldtime's black button with white text. Use compact photo-led activity choices with different scenes, men and women, and different racial backgrounds. Posters should show the owner's photo, activity and genuine achievements, not year labels. Do not use “Save on this device” wording.

**Why:** The user explicitly corrected the Sports presentation and requested diverse scenes, recognizable app controls and activity-first posters.

**How to apply:** Keep these exceptions inside Sports rather than changing the main app's visual language. Describe saved activities and pending sync honestly.

Preserve the purple/green Sports styling and transitions into activity photos. Labels over photos must be white and readable. Use several fresh original scenes, with varied people and account/sign-in image combinations rather than one fixed set for everyone.

**Why:** The user explicitly said they love the purple/green styling and image transition, but corrected the unreadable photo text and requested more varied imagery.

**How to apply:** Change contrast and imagery without replacing the approved interaction design. Selection imagery is decorative, never evidence of a user's workout.

Do not require Mapbox, a paid map plan, a token, proprietary fitness SDK or paid video rendering. Use an open-source renderer, separate replaceable data providers, required attribution and a working, explicitly labelled stylized fallback. Never call terrain or a reference grid satellite imagery.

**Why:** The user explicitly supplied this requirement after rejecting a mandatory Mapbox approach.

**How to apply:** Verify actual browser export and distinguish tested browsers from unknown ones. Public routes are permitted with explicit consent; hide sensitive endpoints by default, including repeated visits near them on loops, and never put raw GPS in public metadata.

Sports posters should be original Oldtime designs, not Strava copies. Keep the UI professional and concise; longer operating explanations belong in collapsed details.

**Why:** The user requested a more original poster, more interesting Minimal style, and less explanatory wording while retaining the approved Sports direction.

**How to apply:** Borrow useful playback and privacy behaviors, not branding. Distinguish detailed aerial coverage from coarse satellite overview and never describe a grid as imagery.

Describe sync as adding completed workouts to account history and reports; do not suggest that syncing changes GPS accuracy or tell users their activity is merely stored on-device. Explain accuracy as a result of the location readings captured, and use calm, specific retry guidance.

**Why:** The user explicitly asked for reassuring, professional Sports Mode wording, with clear account-sync benefits and no misleading local-storage or GPS-accuracy claims.

**How to apply:** Use this language in recording, history, sharing, and error states while preserving accurate disclosure of browser background-tracking limits and real GPS gaps.

## Current Oldtime release status

Sports mode and workout recording are disabled in the app. Preserve existing workouts and historical shared posts; do not restore Sports entry points, start new recording, or accept new Sports writes unless the user explicitly asks.

**Why:** On October 21, 2026, the user chose to hide and disable Sports in Oldtime while retaining existing data.

**How to apply:** Keep the app flag off and mutation routes disabled. Old Sports posts may remain as ordinary feed items; workout data remains available through authenticated read paths.
