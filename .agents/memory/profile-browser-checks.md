---
name: Profile browser checks
description: Keep browser automation aligned with the actual Oldtime creation and profile interaction flow.
---

Browser smoke tests should follow the visible Create hub options, tap the quote canvas to edit its initial text layer, and wait for the editor to close before using navigation again. Data persistence can complete before the editor transition finishes.

**Why:** Tests using removed controls or acting during editor teardown timed out before reaching the behavior under test; current palette tokens also differ from some older color assertions.

**How to apply:** When creation navigation changes, update browser tests to use the user-visible route and refresh expected colors from the current shared design tokens. Keep feature assertions before unrelated legacy visual checks.
