---
name: 3D verification
description: Avoid mistaking a headless-browser graphics limitation for an unavailable avatar studio.
---
Verify graphics capability independently, then exercise the actual model and exported portrait with a real WebGL context. Do not fake WebGL or substitute a flat picture for the selected rotatable-3D experience.

**Why:** The default verification browser lacked WebGL here, while system Chromium with genuine software rendering worked. Once graphics were available, it revealed an app-level model error that the unavailable-graphics screen had masked.

**How to apply:** For Alter Ego rendering checks, confirm a real renderer first, then inspect actual mobile head/body renders and portrait output. Browser infrastructure failure is not proof that the model or save flow works.

Keep large browser-generated binary assets out of JSON transport during verification.

**Why:** Exporting a detailed GLB as an array of byte values through browser automation exhausted the Node heap even though the model rendered successfully. Serialization cost is separate from model/GPU correctness.

**How to apply:** Save generated model bytes through native browser downloads or a binary file channel; inspect metadata and rendered views rather than passing entire byte arrays through automation messages.

For route videos, a ready map and a passing build are not proof of a working export. Verify that the generated video decodes visible frames and advances during playback. State the browser engine tested; a mobile-sized Chromium viewport is not an iPhone/Safari test.

**Why:** The user repeatedly showed failed video exports after map-readiness fixes and successful build checks. Those checks did not exercise the encoded result.

**How to apply:** Before claiming a Sports flyover works, exercise export through the signed-in flow and inspect the resulting playable video, not just the map or enabled export button.
