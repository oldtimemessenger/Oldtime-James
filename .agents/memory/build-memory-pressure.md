---
name: Build memory pressure
description: Distinguish resource-stalled builds from application errors in the shared development runtime.
---
Default Vite builds can stall under shared-runtime memory pressure even when source checks and tests pass. A bounded Node heap completed the unchanged production build.

**Why:** repeated builds stalled while most available RAM was occupied by long-lived browser processes; the same build succeeded with a 512 MB Node heap.

**How to apply:** inspect available memory before changing application code or build semantics. Use a heap cap appropriate to available resources and report the actual build result. Do not kill shared browser services to free memory.

A smaller heap is not always sufficient: distinguish a stalled build under shared pressure from an explicit V8 heap-limit failure. Release isolated test servers owned by the current task before the final production build, then give the bundler enough heap.

**Why:** reducing the heap too far caused an actual out-of-memory failure; the unchanged source built after the isolated test runtime was stopped and a sufficient heap was available.

**How to apply:** finish browser verification before stopping its local API, never stop unrelated workflows or shared browsers, and do not change production build semantics to make a check appear to pass.
