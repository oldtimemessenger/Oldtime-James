---
name: Floating video playback
description: The user's cross-screen mini-player behavior for feed videos.
---

Detach the playing video into a persistent mini-player so people can browse other screens without losing playback. Let them expand it back to full screen, pause it, and close it explicitly.

**Why:** the user asked for the RedNote-style ability to keep a video playing while moving through the app and return to it.

**How to apply:** preserve the current media and playback position when detaching; keep the player above app navigation, and do not treat detaching as a new post or share.

Make the control available on every posted-video playback surface, including Community inline videos, Places and profile/post viewers. Do not add it to the recording camera or creation previews.

**Why:** the user explicitly asked that every video feed content have the control, not just the Home feed.

**How to apply:** keep only one floating player, suppress competing feed autoplay and close it on account changes. Native playback outside the browser depends on device support; retain the in-app player when unavailable.
