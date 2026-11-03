---
name: Partial account-state updates
description: Keep small account actions independent of unrelated settings and saved data.
---

Account-state loads stay read-only. Small actions such as saving or unsaving one post update only the fields they changed. The server merges validated partial updates into existing state, and the client confirms those changed fields rather than requiring a match of unrelated state.

**Why:** A full-state write can be rejected because unrelated settings or collections make the payload invalid or too large, causing a simple save action to fail. Loading should not depend on migrating every legacy field at once.

**How to apply:** For narrow account actions, send a minimal patch, preserve unrelated server data, and verify the exact fields changed. Keep state reads non-mutating; migrate data through bounded, explicit patches.
