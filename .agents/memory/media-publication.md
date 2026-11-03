---
name: Feed media publication
description: Why cloud publication must use the finished composition rather than editor state alone.
---

Treat the finished composition as the published media unless a backend
contract explicitly supports native project layers and their permissions.
Unedited originals can be preserved, but edits must not silently disappear.

**Why:** A successful post write with text and no attached rendered media can
appear in Blast while correctly being excluded from the media-only Home
feed. Persisting editor state or just its background is not equivalent to
publishing the image layers the person actually sees.

**How to apply:** Verify the linked cloud media and its actual pixels after
reload and a clean sign-in, including Following and Profile. Preserve source
audience checks; never bypass missing or restricted comments with a public
fallback render.

Only videos explicitly saved/downloaded to the device carry an encoded Oldtime watermark. Published posts, stories, editable project output and ordinary playback must remain unwatermarked.

**Why:** the user corrected the earlier broad watermark requirement: “watermark only when saved.”

**How to apply:** opt into branding only from device-download actions. Preserve sound and orientation; never fall back to an unwatermarked download after encoding fails.
