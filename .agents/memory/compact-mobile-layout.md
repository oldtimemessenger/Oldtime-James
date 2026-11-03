---
name: Compact mobile layout
description: Oldtime screens must fit narrow phone widths without clipped or split content.
---
The bottom navigation must not fade or dim when switching tabs or pressing its icons. Keep its background solid and its icons and labels fully visible.

**Why:** the user explicitly reported fading when selecting navigation icons and requested no fading.

**How to apply:** preserve the light and dark navigation palettes and selection indicators, but do not add opacity transitions, translucent gradients or press-state dimming to the navigation.

Keep every Oldtime screen compact and readable on mobile. Avoid horizontal overflow, clipped controls, and narrow grid columns that break words into single-character lines. Do not add languages or language packs unless the user asks.

**Why:** the user explicitly asked for compact screens with no spill and said not to add the rejected languages.

**How to apply:** check narrow phone widths across feeds, sheets, profiles, and settings; let text columns shrink and wrap normally while preserving all content and actions.

Use consistent name, icon and action alignment across shared post viewers and suggested-people cards throughout the app, not only on one screen.

**Why:** the user repeated the alignment request and explicitly asked to apply it “across the whole app.”

**How to apply:** keep media captions and compact icons low together, preserve contrast for accounts without uploaded photos, and align recommendation actions despite different name or description lengths.
