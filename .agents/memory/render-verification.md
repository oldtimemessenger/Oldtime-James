---
name: Caught renderer verification
description: Why an isolated interaction test or clean browser pageerror list is not proof that Oldtime Home renders.
---

Verify the actual screen renderer as well as isolated interaction logic. A caught rendering failure must fail the browser check even when no unhandled `pageerror` fires.

**Why:** a passing Home gesture fixture missed a failure in the real Home renderer. Oldtime's error boundary displayed its retry fallback while keeping navigation alive, so checking navigation or unhandled errors alone gave incomplete evidence.

**How to apply:** assert that the intended screen and its primary controls are visible, that the retry fallback is absent, and that caught-render diagnostics are recorded as failures. Distinguish isolated fixtures, Home-only smoke checks, complete user journeys and physical-device verification in reports.
