---
name: Messages and Blast inbox behavior
description: User expectations for paired inbox controls, groups, search results and Saved.
---
Messages must not flash a no-conversations prompt while opening or refreshing. Preserve available conversations; only show the genuine empty state after the signed-in account's inbox has been confirmed empty. A failed load is not an empty inbox.

**Why:** the user reported that switching to Messages briefly looks like there are no conversations, then the conversations appear, making the page feel unstable.

Chat Settings is one consolidated area opened with an inbox settings gear, not three dots. Only its selection controls use black; preserve blue selections elsewhere.

**Why:** the user explicitly requested this limited exception while simplifying inbox settings.

**How to apply:** keep permission choices and inbox controls together; do not spread this black-selection treatment across the rest of the app.

Message bubbles use black and pearly white, not red or blue: sent messages have a black background with pearly-white text, and received messages use the reverse contrast.

**Why:** the user explicitly corrected the message palette and asked to finish it in black and pearly white.

**How to apply:** preserve this message palette, including readable nested replies and voice notes, without replacing unrelated app branding.

Apply inbox button fixes to both Messages and Blast. Group creation belongs in the Groups section, not an unrelated message-search or More action. Saved messages should use bookmark semantics rather than a favorites star.

Keep Chat as a separate app-wide navigation destination when consolidating Blast. Remove only duplicate/embedded private-chat controls from Blast; do not remove the global Chat button or the existing profile-to-chat path.

**Why:** the user corrected a Blast redesign that had removed Chat globally and clarified that Chat must remain outside the Blast surface.

**How to apply:** when simplifying Blast navigation, leave the global Chat destination and its existing conversation behavior intact; keep Chat out of the Blast header and feed tools.

**Why:** the user explicitly clarified “Messages and Blast inboxes” and reported wrong group placement, message-search/display behavior and Saved icons.

Keep the Messages inbox compact and white, with only Search and the Chat Settings gear as header actions. Below, use a movable/swipeable console of rectangular profile cards with genuine notes, then plain conversation rows rather than boxed cards or circular profile rails.

**Why:** the user explicitly requested profile cards, a movable console with notes that shuffle, only settings and search at the top, and a plain old-Facebook-style message list.

**How to apply:** typing filters people and conversations. Keep New message, New group, folders, filters and Saved reachable in the console or consolidated settings, not as extra header actions. Rotate only real notes, pause during interaction and reduced motion, and use the combined story-and-note card rule in current-interface-rules.md rather than a second Stories or People rail. Preserve existing chats and use real counts only. Never fake remote delivery; without an authenticated server, messages remain queued.

Use one consistent modern line treatment for edit actions in Messages and Community; do not restore the older filled edit glyph merely to satisfy an old visual test. In inbox selections, use a pale-blue selected surface, black labels and a blue radio indicator; keep unselected rows neutral.

**Why:** the user's newer professional line-icon request supersedes the older filled-pen reference; the user also repeatedly corrected inbox selection colour and spacing.

**How to apply:** update the shared edit glyph so Community and Messages stay consistent; preserve the existing action labels and behaviors while changing only their icon and selection presentation.

Keep conversation threads on a full white canvas using the current black-and-pearl message palette above. Use compact, iOS-inspired voice-note controls with a visible waveform, timer, discard, pause/play and red send action.

**Why:** the user specified these message-side/color rules and supplied voice-note UI references.

**How to apply:** preserve message direction based on the authenticated sender, keep controls accessible at mobile sizes, and do not introduce blue or green UI accents into the conversation.

Group adjacent messages from the same sender into compact visual clusters. Show one small timestamp outside the bubble at the end of each cluster; show a plain date divider only when the day changes. Show one small “Delivered” or “Read” receipt outside the latest outgoing bubble in each cluster; never use checkmarks. Keep outgoing clusters right-aligned and incoming clusters left-aligned, using the current palette above. Do not show inline save buttons; keep saving in the message menu.

**Why:** the user supplied iOS chat references and asked for sender-side grouping, Apple-style “Delivered” / “Read” receipts rather than checkmarks, and no inline save icons.

**How to apply:** split clusters when the sender, day, or message interval changes; preserve live delivery/read updates; align the one receipt and timestamp at the cluster end; leave the empty thread on a plain white canvas without a boxed empty-state message; and avoid repeating time on every bubble.

For a new, writable thread with no visible messages, offer “Say hi by sending a sticker” with a working waving-hand sticker action. Use an auto-growing multiline composer and preserve line breaks so message text stays readable.

**Why:** the user supplied a first-message sticker reference and asked that chat text fully show.

**How to apply:** keep the greeting unboxed on white, send it through the normal message flow, exclude read-only archives, and let Shift+Enter add a line while Enter sends.

Keep message bubbles sized to their content, not stretched to fill vertical space. In the new-message picker, tapping an individual opens their inbox directly; group mode supports multiple selected people, removable from both the list and selected chips.

**Why:** the user reported oversized short-message bubbles and requested direct individual navigation plus easy group selection and removal.

**How to apply:** keep short text bubbles compact while preserving multiline messages, right/left sender alignment, and show the Create group action only when at least one recipient is selected.

Apply preserved whitespace only to the message-body element, never the bubble wrapper that contains indented HTML template markup.

**Why:** preserving whitespace on the wrapper rendered template indentation as blank lines and made short messages appear as tall blocks.

**How to apply:** keep wrapper whitespace normal; use pre-wrap on the body so intentional newlines in a user's message remain visible.

Use the same white emoji picker throughout the app: search at the top, a dense emoji grid in the middle, and horizontally scrollable category icons along the bottom. Keep favorites and stickers available in chat.

**Why:** the user asked for consistent picker layout across chat, comments, profile and creation flows, based on the supplied emoji keyboard reference.

**How to apply:** update the shared picker rather than creating screen-specific variants; retain search, recents, favorites, category navigation, stickers, and accessible labels.

Keep chat backgrounds plain white. Do not add wallpaper uploaders, wallpaper customization controls, or wallpaper rendering to chat.

**Why:** the user asked to remove wallpaper customization from Chat details and keep chat surfaces white.

**How to apply:** remove wallpaper entry points from chat screens and menus; preserve legacy stored values only when needed for compatibility, but never apply them to the interface.

For signed-in accounts, messages and relationship updates must reach the other account and refresh its open inbox, thread, or request view after connection and mobile resume.

**Why:** the user reported that messages could be sent but not received, and that notifications, friend requests, and follows were not appearing.

**How to apply:** initialize live updates when authentication changes, rehydrate recipient views on connection and resume, and emit refresh events after relationship mutations. Keep server acknowledgement authoritative; do not call a message delivered before the server confirms it.
