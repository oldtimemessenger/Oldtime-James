---
name: Full-screen Create experience
description: Choice-first Status creation and the user's professional v2 photo/video studio requirements.
---

The user wants “the full screen and in screen experience.” Camera capture remains camera-first; the newer v2 media workspace is a full-screen photo/video studio.

Status creation must first offer Camera, Gallery and text Status, without requesting camera permission until Camera is selected. It reuses Oldtime’s renderer, text styles and upload resources rather than the full post editor. The supplied status references apply only to status creation, not Notes, Community, the inbox or the global post composer; do not invent unsupported tools or a browser-accessible device photo library.

**Why:** The user explicitly replaced automatic camera entry with a choice-first Status landing, and reported uploaded landscape and portrait posts being cut off.

**How to apply:** Adapt Studio geometry to uploaded media while retaining existing saved compositions; preserve the full uploaded image rather than forcing a fixed portrait crop.

**Why:** the user explicitly said the inspiration is “for status only” and asked to use “the ressources we already have as in text style etc.”

Status text stays centered and sizes itself to fit, both on a solid canvas and over photo/video. Offer Classic, Plain and Box plus text/background color swatches in one compact row. Do not add text selection boxes, handles, free placement, dragging, resizing or rotation.

**Why:** the user explicitly rejected the blue text bounding box and overlapping Status controls, and asked to leave the main post editor alone.

**How to apply:** keep this restriction inside Status. Normal text editing/selection is still allowed; do not globally remove the main editor's layer tools.

Verify editor changes with freshly loaded browser code, not merely the current file on disk.

**Why:** a reused browser session retained a lazy editor module across source edits, making corrected viewport behavior appear broken until a full page reload.

**How to apply:** refresh the isolated test page after editor JavaScript changes before repeating a failed check. Do not refresh a user's unsaved editor or modify production to resolve a test-session cache.

Status publishing uses a simple busy label, not a numerical percentage counter. Post and comment shares belong in the same lightweight Status flow, with an explicit Send action; they must not silently open the full post editor or publish immediately.

**Why:** the user rejected the “Sending 100%” presentation and asked to retain the established Status style while restoring post/comment sharing.

**How to apply:** preserve fading replies and available history, and keep Reply and Share actions accessible when changing comment data paths. Respect the original content's visibility before preparing a share.

**Why:** the user rejected persistent tool panels, an undersized preview, and camera/toolbar controls visible while typing in the supplied phone screenshots.

**How to apply:** preserve full-screen Camera and Quote. Hide irrelevant controls during typing. Configuration sheets stay open until explicit completion, close, Escape or a dismissal gesture; do not make controls disappear while the user is adjusting them.

Icons must be aligned, and the app should feel professionally done and luxurious, especially while editing.

**Why:** the user explicitly requested this while providing a screenshot of uneven editor controls.

**How to apply:** apply this visual standard to the editor's icons, controls and temporary menus without adding decorative sparkle/star motifs or sacrificing the full-screen experience.

The older on-media tool rail remains unboxed and icon-only. The newer v2 Studio intentionally uses the requested seven named bottom tools instead; do not carry the old label prohibition into that workspace.

**Why:** the user asked for a compact, professional edit screen and specifically rejected boxed controls and labels spilling out of the tool rail.

**How to apply:** preserve accessible `aria-label`s and comfortable touch targets; keep unselected tools transparent and use only a restrained non-rectangular state for the active tool. Do not add tools that exist only in reference screenshots.

The user explicitly requested a CapCut-like v2 photo/video workspace: preview above a real multi-lane timeline, Edit / Audio / Text / Overlay / Filters / Adjust / Canvas bottom sheets, one header Publish entry, twenty filter presets, eleven adjustments, crop/rotate/straighten and hold-to-compare.

**Why:** the user asked for a professional studio rather than another cosmetic restyling of the old posting step. This newer request supersedes the earlier no-filter restriction for the v2 media workspace only.

**How to apply:** preserve existing creative tools and Cloudflare publishing, keep preview and exported pixels consistent, keep photos as photos and sound optional. Do not rebuild the product or restore deleted drafts, GIF tools or sticker authoring merely because a reference app has them. Camera-first capture remains separate from the media editing workspace.

Quote should stay full-screen and require a screen tap before text entry; camera should be the automatic fresh-creation landing. Remove instructional overlays covering the canvas. The user approved deleting all saved Create drafts and draft-only media; preserve published posts and shared media.

**Why:** the user reported obstructed text and misplaced camera controls, then explicitly authorized removing old Create drafts while rebuilding the flow.

**How to apply:** keep quote entry tap-initiated, do not restore old draft migration or storage, and do not replace genuine camera permission/error handling with decorative prompts. Never delete published posts or shared media as draft cleanup.

For the current button palette and login branding, follow [Brand direction](brand-direction.md).

The user's earlier two-finger text resizing/repositioning request applies to the main post editor, not Status. Status must not have pinching, free placement, hand sizing or a blue selection outline. Match supplied UI and icon references precisely; do not substitute a different design.

**Why:** the user explicitly requested these interactions and supplied camera and icon references.

**How to apply:** preserve main-editor text reflow tools unless requested otherwise, but keep Status centered and automatically fitted. Scoped Status focus styles must override global textarea focus outlines. Keep camera/photos immersive with aligned original icons, and never imply browser access to unselected device photos.

Keep one gallery entry using the user's provided glyph, not a replacement drawing or duplicate buttons. It must have a truly transparent background and sit bottom-left beside the shutter, in the original gallery-button position—not above it in the thumbnail strip. It should be a normal app-sized icon, not a large image card. Keep the header toolbar on one row.

**Why:** the user repeatedly rejected the substitute icon, duplicate gallery buttons, white background, wrong position, oversized tile and two-row header in successive camera screenshots.

**How to apply:** retain the provided glyph in a compact touch-accessible button. White/Black tool palettes must keep every control readable without recoloring the actual photo, quote or app-wide design.

Recent photos should appear as a tightly spaced, full-width square thumbnail strip just above the shutter, with a small pull handle. Previously selected or captured photos should reappear, not require a fresh picker selection each time.

**Why:** the user provided a camera-roll reference and emphasized “you see how the pics just appear.”

**How to apply:** show only genuine photos already available to the app, keep device-local recents account-scoped and bounded, and explain that a browser cannot automatically read unselected phone-gallery photos.

Preserve shared Camera, Quote and Stories behavior when editing unrelated Create navigation; keep those changes scoped to the requested entry points.

**Why:** the user objected when a Create change altered existing creation controls.

**How to apply:** do not move, remove, or restyle shared Camera and Quote tools as a side effect of changing Create navigation.

The user wants the whole Create interface redesigned from scratch, with TikTok and Instagram investigated as references and their supplied notes as the guide—not another patch to the existing layout. Create opens the camera immediately, without a Story/Post chooser. Match the uploaded capture UI exactly: Close and centered “New post,” a large rounded live preview, flash and flip inside its upper corners, Photo/Video tabs above a bottom dock, the image/video picker bottom-left, centered shutter, and a real recording timer/stop state. Do not add extra visible capture buttons or reinterpret the reference. Keep on-canvas text/templates, overlays and saved/device audio, touch resizing, and an explicit sharing step afterward. The in-editor share step switches between Main Feed and Story. Feed audiences are Everyone, Friends only, and Close Friends; Story audiences are Your Story and Close Friends. Do not add GIFs, filters, AI tools or restore deleted drafts.

**Why:** the user repeatedly rejected substitutions for their references, clarified the immediate camera landing, and explicitly said “respect the exact ui i uploaded.”

**How to apply:** rebuild Create's presentation and interactions as one coherent flow rather than keeping legacy navigation and adding more panels. Preserve existing accounts, published content and Cloudflare services. Publish the actual composed media, not just its editing state.

For the rebuilt capture screen, preserve behavioral control IDs but do not restore legacy camera wrapper classes just to reuse styles or satisfy old source tests.

**Why:** legacy wrapper styles silently overrode the new layout, enlarged the preview beyond the phone, constrained the title, and hid capture tabs even though control-presence tests passed.

**How to apply:** keep the new capture presentation isolated and check actual mobile DOM hierarchy and visible bounds when changing it. A matching list of control IDs is not sufficient verification.

Remove sticker authoring from Create, but preserve sticker artwork already present in posts and Stories. Background removal applies only to media the user explicitly selected; for text-behind-subject, preserve the original image and place its person-only cutout above the new text.

**Why:** the user wants a sound picker instead of stickers and explicitly clarified that existing sticker artwork must remain untouched in other media.

**How to apply:** do not add or remove sticker layers outside the active Create composition. Keep background removal scoped to the selected source, provide edge refinement, and keep the original source available underneath a subject cutout.

The user chose on-device background-removal refinement and wants the highest achievable accuracy without sending photos to a hosted remover.

**Why:** the user explicitly selected on-device processing and requested top-tier accuracy.

**How to apply:** run segmentation only on selected media, improve the local matte within mobile memory limits, and provide pinch-zoomed manual restore/erase and edge controls. Do not add a paid/hosted removal service or promise proprietary model parity.

The user approved the current on-canvas pinch-zoom mask brush and asked that it remain while background removal continues to improve.

**Why:** the user explicitly praised the new refinement controls and asked to keep them.

**How to apply:** keep the current Restore/Erase, Undo, brush-size, and pinch interactions when changing the segmentation model; upgrade the inference behind the controls rather than replacing the editor experience.
