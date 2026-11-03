---
name: Mounted preview asset paths
description: Avoid duplicate base prefixes when public assets are referenced from Oldtime Technologies' static HTML.
---
Use relative URLs for public assets directly in Oldtime Technologies' index HTML. Explicit `%BASE_URL%` expansion can be prefixed a second time in the mounted artifact preview; verify the final rendered URL and its MIME type under the artifact path.

**Why:** The startup screen requested the logo from a duplicated `/oldtime-technologies/oldtime-technologies/` path while the app's module-based brand URL resolved correctly.

**How to apply:** For public files referenced in static HTML, prefer a path relative to the artifact root and confirm the served URL returns the intended asset rather than an HTML fallback.
