---
name: Screen scroll stability
description: Preserve screen position and visible controls through in-app actions and updates.
---

Actions and background updates must not unexpectedly send a person to the top of a screen or make the controls they are using disappear. Returning from a subpage should return to the previous place. Chat should keep an older-message reading position; follow the newest message only when entering a new thread, sending, or already at the bottom. Keep an open action sheet available while its screen refreshes.

**Why:** the user reported repeated top jumps and disappearing buttons and asked for this behavior to be investigated throughout the app.

**How to apply:** when changing screen actions, verify both same-screen refreshes and return navigation across feeds, settings, Chat, overlays, and the editor. Avoid adding scroll resets that override the user's position.

Provide a compact back-to-top arrow after substantial scrolling on long pages. It must target the actual scrolling pane and respect reduced motion.

**Why:** the user explicitly requested a one-click way to return to the top; this intentional action is different from the unwanted jumps described above.

**How to apply:** keep it hidden near the top and during creation or modal interactions. Never reset scroll merely because another action or background refresh occurred.

Settings renderers must still bind visible controls when cloud data is already cached. Skip only the fetch on a warm-cache path; do not return from the shared renderer before common button handlers are attached.

**Why:** the cached Close Friends path returned before binding Save, so its first save worked but the rerender left later saves inert.

**How to apply:** after any cloud-backed settings mutation, verify a second edit/save cycle and reopen/back behavior, not just the initial save.

Media feeds should use native vertical scrolling with snap and automatic page loading, not depend only on custom touch-swipe handlers. Keep all five primary navigation items, including Search, visible and stable while scrolling.

**Why:** the user asked for TikTok-style continuous video and photo browsing throughout Home and Search, and reported the Search navigation icon disappearing.

**How to apply:** preserve native scroll momentum and pagination on feed surfaces; verify the Search nav slot remains visible after switching tabs and scrolling.
