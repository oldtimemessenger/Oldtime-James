---
name: Website repository scope
description: Why the website GitHub repository uses a filtered snapshot rather than the workspace's complete history.
---
The website repository has independent history created from a clean, filtered source snapshot. Preserve that separation for future GitHub updates.

**Why:** the user approved a private website repository containing required source and assets, excluding secrets, user data and unused references. The workspace also contains other artifacts and previously tracked reference uploads.

**How to apply:** update the website repository against its existing branch, preserving the reviewed export scope. Do not blindly push the workspace's full history, replace its remote, or force-push unrelated artifacts and uploads. Review pending changes in chat before each commit or sync as the user requires.

The user confirmed the private `oldtimemessenger/Oldtime-launch` repository as the destination for the current launch source, including the authoritative website, Cloudflare backend, and Expo wrapper.

**Why:** the user selected the existing `Oldtime-launch` repository after its exact name and empty/private status were checked.

**How to apply:** Keep this launch export separate from the existing website repository and workspace history. Include only the reviewed source and required shared assets; exclude secrets, user data, reference uploads, other artifacts, and generated build/install output. Do not treat approval of the destination as approval to skip the user's pre-commit review.
