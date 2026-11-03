---
name: Launch scope
description: Delivery standard and evidence boundaries for the existing Oldtime app.
---

The user wants the existing app finished for real live users and explicitly requires honesty about readiness.

**Why:** the user said “i want a finish product and do not lie about it.”

**How to apply:** distinguish implemented code, automated tests, live-service verification and unverified features. Never call local social state remote delivery or equate a build with launch readiness. Report outstanding work explicitly.

Imported readiness reports describe another environment; their external configuration and test claims are not fresh evidence here. Previous backend directions are superseded by the live Cloudflare-only direction in [Cloudflare hosting](cloudflare-hosting.md).

**Why:** the user now explicitly identifies Oldtime as a live app with real users and requires Cloudflare for its production data and runtime.

**How to apply:** preserve live Cloudflare records and verify the actual released service separately from code checks. Never describe fixture-based checks as proof that a real user's publication succeeded.

Keep the live Oldtime app running while making changes. Do not stop or archive it for development.

**Why:** the user repeatedly emphasized that the app is live, its accounts belong to real users, and customers are complaining.

**How to apply:** keep isolated browser checks separate from the live service, preserve production data, and never treat stopping a test or a preview workflow as permission to stop the deployed app.

Finish the web app before building the mobile app. Keep the mobile app in a separate repository rather than replacing or moving the existing web app.

**Why:** the user explicitly requested web completion first, followed by mobile development in a new repository named “Oldtimeaws mobile.”

**How to apply:** prioritize verified web readiness and preserve the current web product. Preparing an empty mobile repository does not mean mobile development or web launch readiness is complete.

The mobile app must match the existing website experience, not a simplified or independently redesigned interface.

**Why:** the user rejected the different native interface and explicitly requested “my exact app the way it is as the website.”

**How to apply:** preserve existing layouts, controls and feature behavior when implementing mobile. Explain and obtain agreement on a website container versus a faithful native port; do not silently substitute one for the other.
