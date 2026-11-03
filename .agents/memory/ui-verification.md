---
name: Safe editor verification
description: Avoid forced completion clicks near publishing controls in browser tests.
---

Do not force-click an editor completion control when another control intercepts it, especially if the obstruction is Share or Publish.

Browser fixtures that import the app store can get a different module instance after Vite hot reload.

**Why:** Repeated fixture failures were caused by the app and fixture holding separate hot-reloaded store instances, not failed UI behavior.

**How to apply:** Use a clean workflow start before diagnosing an identity-sensitive fixture; test the actual app DOM and intercept every API mutation when the preview shares live data.

**Why:** a Quote layout test found Done obscured by Share; an attempted forced continuation left a published fixture post instead of reliably completing editing.

**How to apply:** stop on the obstruction, report element geometry, fix the overlap, then use an ordinary click. Use disposable accounts and never interact with a real user's publishing controls in this kind of test.

A rendered preview or post-like screen is not evidence of successful public sharing. Verify a persisted post, associated media, and a playable public media response.

**Why:** Route video opened in Studio and appeared in a post preview even though no public post or media existed on the server.

**How to apply:** Test the actual sharing destination, not just export or composer handoff. Treat local-only previews separately from server-backed delivery.

Keep disposable sharing fixtures until all requested playback views are verified.

**Why:** Early fixture cleanup prevented the desktop/mobile playback extension
and forced another synthetic upload.

**How to apply:** Agree the narrow pass first; verify persisted media and advancing
playback in both viewports before exact cleanup. Never retain credentials in memory files.

For nested creator sheets, keep item selection and configuration interactions inside the sheet. Only explicit place, add, cancel, or back actions should dismiss it.

**Why:** treating a sticker selection or an inline field change as a global overlay-dismiss action closed the editor before the selected item could be configured.

**How to apply:** when wiring a child sheet, exclude its controls from parent click/change dismissal handlers; close the sheet from the explicit commit or cancel path.

When handing off from a share sheet to the Story editor, synchronously close the share sheet before scheduling the editor open.

**Why:** both surfaces use the same sheet host, so a delayed close from the share sheet can clear the newly opened editor.

**How to apply:** close the source sheet first, then queue the destination editor; verify the editor itself is visible and its destination is set, rather than expecting a hidden form control to be visible.
