---
name: Profile gallery
description: Product decisions for organizing profile posts, quote cards, and saved collections.
---

Keep the profile content-first with compact section tabs and a one-column post stack. Put captions, author details, counts and the existing owner menu below each media preview; do not overlay badges or menus on profile media. Tapping a photo or video opens the existing full-screen viewer and its existing actions. Existing text posts remain in Posts and open as ordinary text content; do not show a separate Quote shelf or Quote-specific viewer. Do not show Albums & Memories or its creation controls on profiles.

**Why:** the user asked to hide Quote creation and remove duplicate Quote UI without deleting existing posts; ordinary text content remains part of the profile. They later supplied an Albums & Memories screenshot and explicitly asked to remove that section from the code, then clarified that profile media should be a clean stacked list with actions only after opening the media.

**How to apply:** When changing profile layout, preserve ordinary post opening, owner deletion and saved-tab privacy. Keep the three-dot edit/archive/delete/cover menu on profile cards, never over the media or in the full-screen viewer. Do not restore Albums & Memories. Keep existing stored records/media intact rather than deleting data as part of this UI change.

In the profile Saved section, the bookmark on the section tab is enough; do not repeat bookmark icons in the “All saved” or collection filter buttons. Keep collection cover images when present.

**Why:** the user asked to remove the extra bookmark icon inside the Saved view.

**How to apply:** retain working filters and counts, but use text-only controls for All saved and collections without cover images.

Community-feed posts may be saved, but must not offer collection organization. The bookmark saves or removes the post directly; counts keep their original color while only the saved icon changes color.

**Why:** the user explicitly asked for one-tap saving and no collections for Community posts, with the count color unchanged.

**How to apply:** keep collection organization as an explicit option for eligible non-Community posts only. Never open the collection sheet from a Community bookmark action.
