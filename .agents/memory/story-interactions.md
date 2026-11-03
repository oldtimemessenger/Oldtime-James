---
name: Story interaction scope
description: No layered Home hub or Home status tray; retain avatar, Search and Messages access and the existing Story viewer.
---

Keep an active story ring visible on profile avatars, and let a profile ring open the full-screen viewer. In the viewer, vertical swipes change authors and horizontal swipes change that author's stories. Keep one main viewer close control (X). Replies are cloud-backed and shown as a compact recent-message overlay above the composer, refreshed while the Story is open. In the reply bar, remove the heart and plain smiley; keep the reaction-plus picker and the separate side like/share actions. Reactions from both the owner and other viewers persist on the server; an owner reaction must not create a Story view. Temporary tap bursts are animation only. Private viewer insights and save/delete/reply options share one three-dot entry with compact Views/Options tabs, a Community-like header, and downward swipe dismissal; do not leave a second Views button beside it. Only owners see the Views tab. Use Oldtime's existing typography and neutral controls. The Messages story rail should scroll with its content rather than remain pinned. Quote galleries are separate full-screen experiences browsed vertically by swipe or wheel.

Home must be a plain feed: no layered slide-up hub and no status row at the top. Keep statuses accessible by pressing someone's avatar, through Search/Following Stories, and in the Messages header.

**Why:** the user explicitly removed the two-layer Home experience and its top status row after reviewing it.

**How to apply:** do not restore the hub, cover gestures or Home status tray without a new request. Preserve statuses, privacy checks and their other entry points; this is a presentation change, not data deletion.

On people rows, keep avatar and username actions separate: an avatar opens that person's active, visible Story, or their profile when no Story is available; a username always opens the profile. Profile navigation must retain the originating screen and state so Back returns there, including when opening a profile from the Story viewer.

**Why:** the user explicitly requested distinct Story-avatar and profile-name actions and said Back should return to the previous page, not Home.

**How to apply:** use the shared visibility/expiry checks before opening a Story; otherwise route the avatar to the profile. Route names directly to profiles and push the current navigation state before opening any profile.

**Why:** the user explicitly asked to combine Views with the three dots in a compact, downward-dismissable panel, remove only the first two reply-bar actions, and retain reaction-plus.

**How to apply:** enforce current story visibility and block rules before recording a view or reaction; only the owner may fetch viewer identities. Record each account's view once per story and never count the owner's own view, even when they react. Include owner reactions in the reaction count without listing the owner as a viewer; the owner's selected emoji can be labeled separately in their activity view. Do not show optimistic reactions as confirmed when the API fails. Keep the shared activity/options panel bounded to the viewer, preserve all existing options and owner privacy, and pause progress while it is open. Keep floating bursts bounded and temporary, and do not steal gestures from carousels or other controls.

Stories disappear 24 hours after posting unless the owner chooses to keep them on their profile. Apply the same active-story rule across every existing story surface.

**Why:** the user explicitly requested 24-hour story expiry unless saved.

**How to apply:** use one shared expiry check for story rails, viewers, profile rings, and message surfaces. Community does not display Stories. Keep cloud persistence as the source of truth for Story metadata, interactions and media rather than browser storage.

Story replies are plain, unboxed text rather than rounded bubbles. New replies appear at the bottom; older replies fade upward in chat order and remain available in the scrollable history. Tapping or scrolling the reply area opens that history; interaction keeps it visible and it fades again after reading becomes idle. Fading is visual-only, and reactions stay unchanged.

**Why:** the user repeatedly requested fading replies that stay readable while tapping or scrolling up/down, with the full history preserved.

**How to apply:** fade older messages before newer ones; never delete cloud replies when they fade. Pause Story progress while history is expanded, provide a clear jump to the latest messages, keep scrollback available, and respect reduced-motion settings.
