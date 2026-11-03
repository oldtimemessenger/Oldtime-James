---
name: Blast migration test imports
description: Keep the video-note store's dynamic-source test compatible with module additions.
---

When `blast-video-note-store.js` gains an import, its saved/search store test must rewrite that import to an absolute file URL because it imports transformed source from a `data:` URL.

**Why:** Relative imports cannot resolve from a non-hierarchical `data:` URL; the failure appears in the fixture even when the application code is valid.

**How to apply:** Update the test's source substitutions for new imports and reset the shared Blast cloud-state cache around the fixture.
