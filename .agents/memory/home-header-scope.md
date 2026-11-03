---
name: Home header scope
description: User-approved placement of Home controls and restrictions on unsolicited header changes.
---
The global Home Create entry point is active and opens the “New post” camera immediately, without a choice sheet. Community keeps its separate Create action. Profile is at the top-left of Home and Community ONLY, never Search or Messages. Search replaces Profile in bottom navigation. Remove the Home and Community header search buttons. Keep Search's original page layout, content and controls; moving its navigation icon is not permission to redesign Search. Keep a direct Notifications bell on the right; do not show the hamburger/More menu there. Do not show an “Explore” label or tab in the top Home header. Hide the owner's story tile when they have no active story; when they do have a story, keep their story ring first in the row.

**Why:** The user corrected the extra avatars on Search and Messages and repeated that Search was only to be moved, not redesigned. Home and Community placement was explicitly approved.

**How to apply:** Keep the direct Home Create camera separate from Community's composer. The five bottom buttons are Home, Community, Create, Messages, and Search. Home has Following first and For You second; put topic categories and Places discovery in Search. Keep Stories in the Home header: tapping a story opens the full-screen swipe viewer, and scrolling up hides the strip while scrolling back down reveals it. Preserve Notifications and the active-story-only owner tile.

The user wants full-frame Home content with no fade at the top.

**Why:** they supplied a TikTok feed reference and explicitly said “full and no fade up top on home page.”

**How to apply:** preserve the requested control positions and feed tabs; maintain readability on individual controls without darkening the entire top of the media.

Put the account owner's compact avatar/profile shortcut at the top-left of Home and Community only.

**Why:** the user's newer explicit request restores it there.

**How to apply:** scope shared header decoration to those two routes before matching header classes, since Search also uses Community's base header class. Do not alter Search or Messages headers, back buttons, media controls or editor sheets.

Activity must open account data and engagement insights, not the app menu or a notification-filter dropdown.

**Why:** The user explicitly said Activity is supposed to lead to account data and engagement.

**How to apply:** Keep profile/settings access intact and use the account-type-appropriate analytics dashboard. Back must return to the page that opened Activity.
