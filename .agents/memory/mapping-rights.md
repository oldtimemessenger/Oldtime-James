---
name: Mapping and replay export rights
description: Google live-view alternatives have different billing and export constraints from free replay sources.
---
Do not equate permission to display a map with permission to export and redistribute user route videos.

**Why:** The 2026-10-10 review found Google's Map Tiles video policy limits the expressly permitted clips to promotional application-capability videos, with attribution, a 30-second limit, and other restrictions. It is not blanket permission for automatic consumer route-video sharing.

**How to apply:** Re-check https://developers.google.com/maps/documentation/tile/policies and https://cloud.google.com/maps-platform/terms before adding Google content to exported feed media. Keep exports on separately permitted sources unless appropriate additional permission is obtained.

Google's no-billing Maps Demo Key supports experimental 2D/3D map viewing but is expressly not for production. Production Google Maps requires billing even when monthly free allowances apply; neither a free allowance nor a budget alert guarantees zero charges. Check https://developers.google.com/maps/documentation/javascript/demo-key before proposing a prototype.

OpenStreetMap standard raster tiles are community-funded, best-effort, and require visible attribution, browser Referer and normal HTTP caching. Do not bulk-prefetch map regions or distribute offline tile packages. A rendered map image/video is not an offline tile archive, but requests must remain limited to the actively viewed map area. Policy: https://operations.osmfoundation.org/policies/tiles/.

## Sports live-map provider direction

Keep Sports maps free of paid provider keys, make any external tile-service dependency clear, and keep the provider replaceable so the app can move to self-hosted vector tiles later. Only draw routes from accepted real GPS points; never synthesize route or nearby-user data.

**Why:** The user explicitly wants a real, accurate live map without a paid map API and wants a future self-hosting path rather than a permanent lock-in to today's public provider.

**How to apply:** For new Sports basemap work, verify the active provider's current terms, preserve visible data attribution, request tiles only for the viewed area, and describe external availability as best-effort. A self-hosted move is not complete until its tile server and operations are actually provisioned.

## OpenFreeMap video exports

OpenFreeMap's public instance permits video use with the visible credit `OpenFreeMap © OpenMapTiles Data from OpenStreetMap`. Keep that credit inside every exported map video and image, not only in the interactive map controls.

**Why:** The provider's official homepage, checked 2026-10-12, explicitly requires that attribution for printed media and video; its terms describe the public service as free and as-is without an availability guarantee.

**How to apply:** Re-check OpenFreeMap's current terms and attribution before changing providers or removing the video credit. Keep route lines sourced only from the user's recorded GPS.

## Vector flyover and optional terrain

Keep the mapped-building flyover as the default. Terrain is a separate, explicit map choice; include DEM terrain in a replay/export only when the user selects it and the provider reports usable coverage. Never imply global terrain coverage, invent elevation, or bridge GPS gaps.

**Why:** The user's latest direction asks for a terrain toggle while preserving the existing city/building view as a distinct option.

**How to apply:** Preserve OpenFreeMap video attribution when used. For terrain, preserve the configured DEM provider's own credits and fallback behavior. Keep video aspect ratios undistorted, limit mobile export resources, and report coverage/playback limitations rather than presenting unverified output as working.

## Aerial and satellite imagery exports

On 2026-10-13, official source terms were checked for the existing free imagery sources. USGS The National Map is public domain and requests its source acknowledgment; NASA Blue Marble asks users to credit NASA Earth Observatory; Copernicus permits reproduction, distribution, public communication, and adaptation, with a required source notice and a modified-data notice when applicable.

**Why:** These sources can supply photographic backgrounds for user route videos, but their coverage, freshness, resolution, and attribution differ; elevation-relief tiles are not satellite imagery.

**How to apply:** Keep the provider's current attribution inside exported media, including `Contains modified Copernicus Sentinel data [year]` for adapted Sentinel imagery. Label USGS imagery as aerial, not satellite; report source and resolution limits, and avoid paid or unverified imagery services.
