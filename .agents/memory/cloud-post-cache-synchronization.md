---
name: Cloud post cache synchronization
description: Keep feed, profile and standalone detail copies in sync after server-confirmed post actions.
---

After the server confirms a cloud post action, update every active cached copy, including the feed, profile/repost lists and standalone opened post. Visible controls should read from that same updated state.

**Why:** A post opened from Places can live only in a detail cache; updating feed copies alone leaves a successful Like looking unchanged.

**How to apply:** Route cloud post mutations through a shared copy-update helper and test actions on posts opened directly from Places or a profile, not only from the main feed.

Profile galleries must remain independent of the currently loaded Home feed. Keep the profile's confirmed server posts and newly confirmed publications available across Home feed refreshes; do not treat an unloaded feed as an empty profile.

**Why:** Published content disappeared from profiles when profiles relied on whichever Home feed page happened to be cached.

**How to apply:** isolate gallery state by signed-in account, preserve confirmed posts on refresh failure, and keep photos in Posts while Videos remains video-only.

After a server-confirmed Community publication, synchronize the returned post into Discover immediately; keep Following strictly follow-only.

**Why:** The Community feed maintains its own cache, so updating only the general store leaves a successful new post invisible until a later fetch.

**How to apply:** Merge the confirmed post into Discover by ID, select Discover after publishing, and never inject the creator’s own post into Following.
