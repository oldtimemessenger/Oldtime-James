---
name: Map layer presentation
description: Places navigation and presentation, plus historical map-layer constraints.
---
Selecting Places in Search must open the dedicated Places UI, not a plain place-results list inside Search. Show recommended, varied place cards by default; typed searches show matching places and suggestions within that same Places screen.

**Why:** the user explicitly clarified the landing behavior for Places, including the no-query and typed-query cases.

**How to apply:** reuse the existing Places landing and search behavior for both the filter chip and other Search entry points; do not create a second Places interface.

The user wants blue highlights along the mapped street network, inspired by their Strava screenshot, not only isolated GPS heat spots. Use real road geometry for street highlights; never label those lines as popular routes or crowd activity.

**Why:** The user rejected the point-density-only interpretation of their map-layer reference. Crowds and popularity require real activity evidence.

**How to apply:** Keep road highlights and the user's own recorded GPS density as separate layers. Keep map controls compact and scoped to Sports. Production maps must remain free of paid tokens or charge-generating APIs; keep the basemap usable when an optional layer is unavailable.

A replay/export uses the mapped 3D city flyover as its sole automatic style; do not expose satellite/aerial or terrain alternatives in that flow. Other map surfaces may retain their own appropriate controls. Never describe a street map, terrain relief, or stylized grid as satellite imagery.

**Why:** On 2026-10-13 the user narrowed the route-video experience to one automatic 3D city flyover after rejecting non-photographic map output as a substitute for satellite imagery.

**How to apply:** Keep remaining map styles scoped to their other surfaces. Use only free permitted sources and preserve required attribution in maps and exports.

Places stays focused on named post tags: people choose a place for a post (for example, Miami or Miami Beach), and the name remains visible on that post. Public discovery is a full-screen, searchable feed of actual tagged posts and hashtags, with a dense two-column gallery like a profile grid. Keep the map behind the content and hidden by default; reveal it by swiping the content down and cover it by swiping up. Do not show a Map button. Do not attach places to Stories or add business claims or bookings.

The user's newer Places request supersedes the earlier restriction on place profiles and people: add place name/category/address, post and people counts, Post here, Top/Recent/People tabs, and editable one-per-person ratings with short tips and reports. Keep MapLibre, OpenFreeMap, Photon and the OpenStreetMap contributor credit; no paid provider, API key, Stories/status changes, or deployment as part of this work. Custom typed places cannot collect ratings.

**Why:** The user explicitly requested free place profiles mixing post tagging with place discovery and ratings, while preserving the current design and production site.

**How to apply:** Treat place pages as user-generated social content, not claimed business listings. New storage must be additive. Review identity comes from the authenticated session, never a submitted account ID.

**Why:** On 2026-10-24 the user asked for a content-first discovery experience around public place tags and corrected that this work is unrelated to Sports.

**How to apply:** Persist coordinates only from an explicitly chosen search result; never attach device coordinates as the post's place. A selected tag map must center and zoom on that saved place; only the unfiltered discovery map should fit the full set of tagged places. Use one free, light street-map style throughout Places and retain required provider credits. Load the optional map only after swipe reveal; request the visible area on demand and never store tiles in app storage. Keep the post feed usable with a bounded loading fallback. Do not change Sports as part of Places work.

When someone opens a tagged post from Places discovery, show the immersive full-media viewer, not a Story viewer. The newer request explicitly allows Like, Comment and Share, including comment counts and friendly prompts; do not restore post saves or reposts there. The creator name and View profile open the creator’s regular Posts profile. Keep map pins on the map, not over people’s media.

**Why:** On 2026-10-24 the user clarified the exact Places content-to-profile flow and rejected location pins over content.

**How to apply:** Preserve the selected place and navigation path between discovery, the full post, and creator profile. Hide the global discovery header on Places pages and use icon-only place search. Keep creator and location details low in the immersive post viewer, use server-confirmed Like/Comment/Share actions, and do not route this flow through Story interactions.

Place pages must be compact: a small round cover thumbnail, one header name, short metadata lines, compact actions and tabs, and readable glass-panel post cards. Offer ratings only for real venues, never countries, cities or regions.

**Why:** the user rejected oversized Greece headers and explicitly requested compact place pages, venue-only ratings, and post comments.

**How to apply:** retain free map/search providers and attribution; nearby permission is opt-in and lack of location must not block browsing.
