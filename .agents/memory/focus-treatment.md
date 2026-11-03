---
name: Focus treatment
description: The app should not show oversized browser selection/focus rectangles around text-entry fields.
---

Avoid heavy external focus boxes on text inputs, textareas and selects throughout Oldtime. Keep normal caret visibility, text selection, copying and keyboard editing; use the field's existing border or subtle border change instead of an offset outline.

For inbox and discovery search, use a borderless light-gray capsule with a transparent inner input. Checked inbox filters use a pale-blue rounded row and blue radio; avoid a second strong outline on the already-selected row.

**Why:** the user repeatedly identified large selection-style boxes as unwanted and supplied references for the search capsule and pale-blue selected state.

**How to apply:** suppress oversized focus boxes on editable fields without disabling text selection, and retain clear keyboard focus on unselected controls. Keep the inbox/search capsule and checked-row treatment as the single visual state.

The policy also covers emoji-search inputs and other sheets mounted directly on the document body, outside the main app shell.

**Why:** the user repeated that the blue selection-style box must not return anywhere in the app and supplied an emoji-search screenshot.

**How to apply:** apply the editable-field focus policy at document level, not only under the phone container. Preserve the native caret, selection and keyboard editing.
