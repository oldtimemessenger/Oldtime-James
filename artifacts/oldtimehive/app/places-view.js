import "./places-view.css";
import "./place-profile.css";
import { isDefaultAvatarMediaReference } from "./story-media.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

const safeHref = value => {
  const href = String(value ?? "").trim();
  if (!href) return "";
  try {
    const parsed = new URL(href, globalThis.location?.origin || "https://oldtime.example");
    return ["https:", "http:"].includes(parsed.protocol) ? href : "";
  } catch { return ""; }
};

const localMediaReference = value => /^oldtime-media:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? "").trim());

function mediaSourceAttributes(value, ownerId = "") {
  const reference = String(value ?? "").trim();
  if (localMediaReference(reference)) {
    return `data-local-media="${esc(reference)}"${ownerId ? ` data-local-media-owner="${esc(ownerId)}"` : ""}`;
  }
  const href = safeHref(reference);
  return href ? `src="${esc(href)}"` : "";
}

const icon = name => {
  const paths = {
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
    arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
    back: '<path d="M19 12H5m7 7-7-7 7-7"/>',
    heart: '<path transform="matrix(.3 0 0 .3 -10.8 -.45)" vector-effect="non-scaling-stroke" d="M76 22C64 8 47 18 47 36c0 17 20 31 30 38 12-8 30-21 30-38 0-18-18-28-31-14L76 22Z"/>',
    comment: '<path transform="matrix(.3 0 0 .3 -11.25 -46.8)" vector-effect="non-scaling-stroke" d="M77 164c-16 0-29 12-29 28 0 12 6 20 17 25l-3 12 16-12c17 0 29-12 29-27 0-15-13-26-30-26Z"/>',
    share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12m-4-8 4-4 4 4"/>',
    locate: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
    video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  };
  return `<svg class="places-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
};

const number = value => new Intl.NumberFormat().format(Number.isFinite(Number(value)) ? Number(value) : 0);
function placeCoordinates(place) {
  const coordinate = (value, max) => {
    if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && Math.abs(parsed) <= max ? parsed : null;
  };
  const lat = coordinate(place?.lat, 90);
  const lon = coordinate(place?.lon, 180);
  return lat === null || lon === null ? null : { lat, lon };
}
function placeCoordinateAttributes(place) {
  const point = placeCoordinates(place);
  const meta = [
    place?.category ? `data-place-category="${esc(place.category)}"` : "",
    place?.address ? `data-place-address="${esc(place.address)}"` : "",
    place?.city ? `data-place-city="${esc(place.city)}"` : "",
  ].filter(Boolean).join(" ");
  return [point ? `data-place-lat="${esc(point.lat)}" data-place-lon="${esc(point.lon)}"` : "", meta].filter(Boolean).join(" ");
}

const REVIEW_TAGS = ["Food", "View", "Cheap", "Busy", "Hidden gem"];
const ratingValue = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(5, parsed) : null;
};
function starRow(value, { label = true, className = "" } = {}) {
  const rating = ratingValue(value);
  if (rating === null) return "";
  const filled = Math.round(rating);
  const stars = [1, 2, 3, 4, 5].map(n => `<span class="${n <= filled ? "on" : ""}">★</span>`).join("");
  return `<span class="place-stars ${className}" role="img" aria-label="${label ? `Rated ${esc(rating.toFixed(1))} out of 5` : ""}"><span aria-hidden="true">${stars}</span></span>`;
}
function personName(person) {
  return person?.displayName || person?.username || "Oldtime member";
}
function personAvatar(person, className = "place-person-avatar") {
  const id = String(person?.id || "");
  const attrs = mediaSourceAttributes(isDefaultAvatarMediaReference(person?.avatar) ? "" : person?.avatar, id);
  if (attrs) return `<img class="${className}" ${attrs} alt="" loading="lazy" decoding="async">`;
  const initial = String(personName(person)).trim().charAt(0).toUpperCase() || "?";
  return `<span class="${className} is-initial" aria-hidden="true">${esc(initial)}</span>`;
}
const dateLabel = value => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
};

function attributionMarkup(attribution) {
  if (!attribution) return "";
  const text = typeof attribution === "string" ? attribution : attribution.text;
  const href = safeHref(typeof attribution === "object" ? attribution.url : "");
  if (!text) return "";
  return `<p class="places-attribution">${href
    ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`
    : esc(text)}</p>`;
}

function statusMarkup({ loading, error, empty, noun }) {
  if (loading) return `<div class="places-state" role="status"><span class="places-state-line"></span><span class="places-state-line short"></span><span class="places-state-line"></span><span class="places-state-copy">Loading ${esc(noun)}…</span></div>`;
  if (error) return `<div class="places-state" role="alert"><strong>Couldn’t load ${esc(noun)}.</strong><p>Try again in a moment.</p></div>`;
  if (empty) return `<div class="places-state"><strong>${esc(empty.title)}</strong><p>${esc(empty.copy)}</p></div>`;
  return "";
}

function placeCity(place) {
  if (place?.city) return String(place.city).trim();
  const parts = String(place?.address || place?.label || "").split(",").map(part => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : "";
}
function placeRatingInfo(item) {
  const info = item?.placeRating || { averageRating: item?.averageRating, ratingCount: item?.ratingCount };
  const count = Number(info?.ratingCount) || 0;
  const avg = ratingValue(info?.averageRating);
  return count && avg !== null ? { avg, count } : null;
}
function placeMetaLine(place) {
  const city = placeCity(place);
  const bits = [place?.category, city && city !== place?.label ? city : ""].filter(Boolean);
  return bits.length ? `<span class="places-card-place-meta">${bits.map(esc).join(" · ")}</span>` : "";
}
function ratingLine(rating) {
  return rating ? `<span class="places-card-rating" aria-label="Rated ${esc(rating.avg.toFixed(1))} out of 5 from ${number(rating.count)} ${rating.count === 1 ? "rating" : "ratings"}">${starRow(rating.avg, { label: false })}<span aria-hidden="true">${esc(rating.avg.toFixed(1))} (${number(rating.count)})</span></span>` : "";
}

function placeCard(item) {
  const place = item?.place || {};
  const previewAttributes = mediaSourceAttributes(item.previewReference, item.previewOwnerId || "");
  const kind = item.previewType === "video" ? "Video" : "Photo";
  const coordinates = placeCoordinateAttributes(place);
  const previewMarkup = previewAttributes
    ? `<img class="places-card-image" ${previewAttributes} alt="${kind} shared at ${esc(place.label)}" loading="lazy" decoding="async">${item.previewType === "video" ? `<span class="places-media-type">${icon("video")}<span class="sr-only">Video</span></span>` : ""}`
    : `<span class="places-card-no-preview">${icon("pin")}</span>`;
  const posts = Number(item.postCount) || 0;
  const rating = placeRatingInfo(item);
  const card = `<button type="button" class="places-card" data-testid="button-place-${esc(place.id)}" data-action="select-place" data-place-id="${esc(place.id)}" data-place-label="${esc(place.label)}" data-place-source="${esc(place.source || "custom")}" ${coordinates} aria-label="Explore ${esc(place.label)}">
    <span class="places-card-media">${previewMarkup}</span>
    <span class="places-card-copy">
      <span class="places-card-title">${esc(place.label)}</span>
      ${placeMetaLine(place)}
      ${ratingLine(rating)}
      <span class="places-card-meta">${number(posts)} ${posts === 1 ? "post" : "posts"}</span>
    </span>
  </button>`;
  const featuredId = String(item?.featuredPostId || "").trim();
  if (!featuredId) return card;
  const comments = Number(item.commentCount) || 0;
  return `<div class="places-card-wrap">${card}<button type="button" class="places-card-comment" data-place-post-comment="${esc(featuredId)}" data-testid="button-place-card-comment-${esc(place.id)}" aria-label="${comments ? `${number(comments)} ${comments === 1 ? "comment" : "comments"} on the top post at ${esc(place.label)}. Add a comment` : `Be the first to comment on the top post at ${esc(place.label)}`}">${icon("comment")}${comments ? `<span>${number(comments)}</span><span class="places-card-comment-copy">Add a comment</span>` : `<span class="places-card-comment-copy">Be the first to comment</span>`}</button></div>`;
}

export function renderDiscoveryPlaces({ places = [], loading = false, error = "", query = "", landing = null, location = null } = {}) {
  const validPlaces = Array.isArray(places) ? places.filter(item => item?.place?.id && item?.place?.label) : [];
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const visiblePlaces = normalizedQuery.length < 2
    ? validPlaces.filter(item => item.place.label.toLowerCase().includes(normalizedQuery))
    : validPlaces;
  const landingHtml = !normalizedQuery ? landingMarkup(landing, location) : "";
  if (landingHtml) {
    const landingEmpty = ["loved", "nearby", "suggested", "trending"].every(key => !(Array.isArray(landing?.[key]) && landing[key].length));
    const fallback = landingEmpty && !loading && !error && validPlaces.length ? `<div class="places-list" aria-label="Tagged places">${validPlaces.map(placeCard).join("")}</div>` : "";
    return `<section class="places-view discovery-places" aria-label="Places">${landingHtml}${fallback}</section>`;
  }
  let state = "";
  if (loading) {
    state = `<div class="places-state" role="status"><span class="places-state-line"></span><span class="places-state-line short"></span><span class="places-state-copy">Loading tagged places…</span></div>`;
  } else if (error && !visiblePlaces.length) {
    state = `<div class="places-state" role="alert"><strong>${esc(error)}</strong><button type="button" class="places-retry" data-discovery-places-retry>Try again</button></div>`;
  } else if (!visiblePlaces.length) {
    state = `<div class="places-state"><strong>${normalizedQuery ? "No tagged places match" : "No tagged places yet"}</strong><p>${normalizedQuery ? "Try a city or a shorter place name." : "Places appear here after people tag them on public posts."}</p></div>`;
  }
  return `<section class="places-view discovery-places" aria-label="Places tagged on public posts">
    ${state}
    ${error && visiblePlaces.length ? `<p class="places-search-status" role="status">${esc(error)}</p>` : ""}
    ${!loading && visiblePlaces.length ? `<div class="places-list" aria-label="Tagged places">${visiblePlaces.map(placeCard).join("")}</div>` : ""}
  </section>`;
}

function placeSearchCard(entry) {
  const item = entry?.place?.id ? entry : { place: entry };
  const place = item.place;
  if (!place?.id || !place?.label) return "";
  const coordinates = placeCoordinateAttributes(place);
  const preview = mediaSourceAttributes(item.previewReference, item.previewOwnerId || "");
  const posts = Number(item.postCount) || 0;
  const rating = placeRatingInfo(item.placeRating ? item : { ...place, ...item });
  return `<button type="button" class="places-search-result" data-testid="button-place-result-${esc(place.id)}" data-action="select-place" data-place-id="${esc(place.id)}" data-place-label="${esc(place.label)}" data-place-source="${esc(place.source || "custom")}" ${coordinates} aria-label="View ${esc(place.label)}">
    <span class="places-search-result-pin${preview ? " has-preview" : ""}">${preview ? `<img ${preview} alt="" loading="lazy" decoding="async">` : icon("pin")}</span>
    <span class="places-search-result-copy"><b>${esc(place.label)}</b>${placeMetaLine(place)}${ratingLine(rating)}${posts ? `<small>${number(posts)} ${posts === 1 ? "post" : "posts"}</small>` : ""}</span>
    <span class="places-card-arrow" aria-hidden="true">›</span>
  </button>`;
}

function landingRow(title, key, items, extra = "") {
  const valid = Array.isArray(items) ? items.filter(item => item?.place?.id && item?.place?.label) : [];
  if (!valid.length && !extra) return "";
  return `<section class="places-landing-section" data-places-section="${key}" aria-label="${esc(title)}">
    <h2 class="places-section-title">${esc(title)}</h2>
    ${extra}
    ${valid.length ? `<div class="places-landing-row">${valid.map(placeCard).join("")}</div>` : ""}
  </section>`;
}

// landing = { loved, nearby, suggested, trending } (PlaceDiscoveryItem[]);
// location = { status: "idle"|"requesting"|"granted"|"denied"|"unavailable", label? }
export function renderPlacesLanding({ landing = null, location = null } = {}) {
  return landingMarkup(landing, location);
}
const LANDING_TITLES = { nearby: "Near you", loved: "Places people love", trending: "Trending this week", suggested: "Suggested for you" };
const LANDING_REASONS = { nearby: "Near you", loved: "Loved", trending: "Trending", suggested: "For you" };
// Round-robin merge of server recommendation buckets into one varied, de-duplicated list.
export function mixLandingPlaces(landing, limit = 24) {
  if (!landing) return [];
  const order = ["nearby", "loved", "trending", "suggested"];
  const buckets = order.map(key => (Array.isArray(landing[key]) ? landing[key] : []).filter(item => item?.place?.id && item?.place?.label).map(item => ({ item, key })));
  const seen = new Set(); const out = [];
  for (let i = 0; out.length < limit && buckets.some(bucket => i < bucket.length); i += 1) {
    for (const bucket of buckets) {
      const entry = bucket[i];
      if (!entry || seen.has(entry.item.place.id)) continue;
      seen.add(entry.item.place.id); out.push(entry);
      if (out.length >= limit) break;
    }
  }
  return out;
}
function landingMarkup(landing, location) {
  if (!landing) return "";
  const status = location?.status || "idle";
  const nearby = Array.isArray(landing.nearby) ? landing.nearby : [];
  let nearExtra = "";
  if (!nearby.length) {
    if (status === "idle") nearExtra = `<div class="places-nearby-ask"><p>See places around you</p><button type="button" class="places-nearby-btn" data-places-nearby data-testid="button-places-nearby">${icon("locate")}<span>Use my location</span></button></div>`;
    else if (status === "requesting") nearExtra = `<p class="places-nearby-note" role="status">Finding places around you…</p>`;
    else if (status === "denied") nearExtra = `<p class="places-nearby-note">Location is off. You can still search any place above.</p>`;
    else if (status === "unavailable") nearExtra = `<div class="places-nearby-ask"><p>Couldn’t get your location.</p><button type="button" class="places-nearby-btn" data-places-nearby>${icon("locate")}<span>Try again</span></button></div>`;
    else nearExtra = `<p class="places-nearby-note">No tagged places near ${esc(location?.label || "you")} yet.</p>`;
  }
  const mixed = mixLandingPlaces(landing);
  if (!mixed.length && !nearExtra) return "";
  const title = location?.label && nearby.length ? `Places for you near ${location.label}` : "Places for you";
  return `<div class="places-landing">
    <section class="places-landing-section" data-places-section="recommended" aria-label="${esc(title)}">
      <h2 class="places-section-title">${esc(title)}</h2>
      ${nearExtra}
      ${mixed.length ? `<div class="places-landing-grid">${mixed.map(({ item, key }) => `<div class="places-landing-cell" data-places-reason="${key}"><span class="places-reason" title="${esc(LANDING_TITLES[key])}">${esc(LANDING_REASONS[key])}</span>${placeCard(item)}</div>`).join("")}</div>` : ""}
    </section>
  </div>`;
}

export function renderPlacesBrowse({
  places = [],
  posts = [],
  loading = false,
  error = false,
  attribution = null,
  searchQuery = "",
  searchResults = [],
  searchLoading = false,
  searchError = false,
  mapVisible = false,
  mapAvailable = false,
  landing = null,
  location = null,
  personForPost = null,
} = {}) {
  const query = String(searchQuery || "").trim();
  const results = Array.isArray(searchResults) ? searchResults.filter(entry => (entry?.place || entry)?.id && (entry?.place || entry)?.label) : [];
  const searchMarkup = query.length >= 2
    ? `<div class="places-search-results" aria-label="Place search results">
        ${searchLoading ? `<p class="places-search-status" role="status">Searching tagged places…</p>` : ""}
        ${searchError ? `<p class="places-search-status" role="alert">Place search is unavailable. Try again.</p>` : ""}
        ${!searchLoading && !searchError && results.length ? results.map(placeSearchCard).join("") : ""}
        ${!searchLoading && !searchError && !results.length && !query.startsWith("#") ? `<p class="places-search-status">No matching place tags. Matching posts still appear below.</p>` : ""}
      </div>`
    : "";
  const items = Array.isArray(posts) ? posts.filter(post => post?.id) : [];
  const feedState = statusMarkup({
    loading,
    error,
    empty: !loading && !items.length
      ? { title: query ? "No matching tagged posts" : "No tagged posts yet", copy: query ? "Try another place name or hashtag." : "Public photo and video posts tagged with places will appear here." }
      : null,
    noun: "tagged posts",
  });
  const mapMarkup = mapAvailable
    ? `<div class="places-map-backdrop" aria-hidden="${mapVisible ? "false" : "true"}" ${mapVisible ? "" : "hidden"}>
        <div class="places-map-card">
          <div class="places-map" data-place-discovery-map aria-label="Map of places tagged on public posts"></div>
          <p class="places-map-status" data-place-map-status role="status">Loading map…</p>
        </div>
        ${attributionMarkup(attribution)}
      </div>`
    : "";
  return `<section class="places-view places-browse ${mapVisible ? "is-map-revealed" : ""}" aria-labelledby="places-heading">
    ${mapMarkup}
    <div class="place-grid-sheet">
      ${mapAvailable ? `<button type="button" class="place-map-grabber" data-place-map-handle aria-label="${mapVisible ? "Hide map" : "Reveal map"}" aria-expanded="${mapVisible}"><span aria-hidden="true"></span></button>` : ""}
      <div class="places-browse-scroll">
        <h1 id="places-heading" class="sr-only">Places</h1>
        <form class="places-search-form" data-places-search-form>
          <label class="places-search"><span class="sr-only">Search places or hashtags</span><input id="places-search-input" type="search" enterkeyhint="search" data-action="search" value="${esc(searchQuery)}" placeholder="Search places or #tags" autocomplete="off"></label>
          <button type="submit" class="places-search-icon" aria-label="Search places">${icon("search")}</button>
        </form>
        ${searchMarkup}
        ${!query ? landingMarkup(landing, location) : ""}
        ${!query && landing ? `<h2 class="places-section-title">Latest posts</h2>` : ""}
        ${feedState || `<div class="place-feed-list" aria-label="Posts tagged at places">${items.map(post => placeFeedCard(post, { personForPost })).join("")}</div>`}
        ${error ? `<div class="places-more"><button type="button" data-action="retry-place-feed">Try again</button></div>` : ""}
      </div>
    </div>
  </section>`;
}

function postPreview(post) {
  const media = Array.isArray(post.media) ? post.media.filter(item => {
    const reference = typeof item === "string" ? item : item?.reference;
    return reference && !isDefaultAvatarMediaReference(reference);
  }) : [];
  const firstMedia = media[0];
  const mediaReference = typeof firstMedia === "string" ? firstMedia : firstMedia?.reference;
  const rawPoster = post.mediaPosters?.[0] || (typeof firstMedia === "object" ? firstMedia?.thumbnailReference : "");
  const posterReference = isDefaultAvatarMediaReference(rawPoster) ? "" : rawPoster;
  const isVideo = post.kind === "video";
  const ownerId = String(post.author?.id || "");
  const imageReference = posterReference || (!isVideo ? mediaReference : "");
  const imageAttributes = mediaSourceAttributes(imageReference, ownerId);
  if (imageAttributes) {
    return `<span class="places-post-media"><img ${imageAttributes} alt="${isVideo ? "Video" : "Photo"} shared at this place" loading="lazy" decoding="async">${isVideo ? `<span class="places-post-type">${icon("video")}<span class="sr-only">Video</span></span>` : ""}</span>`;
  }
  const videoAttributes = isVideo ? mediaSourceAttributes(mediaReference, ownerId) : "";
  if (videoAttributes) {
    return `<span class="places-post-media"><video class="places-post-video" ${videoAttributes} muted playsinline preload="metadata"></video><span class="places-post-type">${icon("video")}<span class="sr-only">Video</span></span></span>`;
  }
  const text = String(post.caption || post.text || "").trim();
  return `<span class="places-post-text">${esc(text || (post.kind === "text" ? "A text post" : "Post shared at this place"))}</span>`;
}

function postRatingMarkup(post) {
  const info = post?.placeRating;
  const count = Number(info?.ratingCount) || 0;
  if (!info || !count || ratingValue(info.averageRating) === null) return "";
  return `<span class="place-post-rating" aria-label="Place rated ${esc(Number(info.averageRating).toFixed(1))} out of 5 from ${number(count)} ${count === 1 ? "rating" : "ratings"}">${starRow(info.averageRating, { label: false })}<span aria-hidden="true">${esc(Number(info.averageRating).toFixed(1))}</span></span>`;
}

function postCard(post, { hidePlace = false } = {}) {
  if (!post?.id) return "";
  const caption = String(post.caption || post.text || "").trim();
  const date = dateLabel(post.created ?? post.createdAt);
  const author = post.author || {};
  const authorId = String(author.id || "");
  const authorName = author.displayName || author.username || "Oldtime member";
  const avatar = mediaSourceAttributes(author.avatar, authorId);
  const likes = Number(post.likeCount) || 0;
  const place = post.place?.id && post.place?.label
    ? post.place
    : post.location
      ? { id: `custom:${String(post.location).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label: post.location, source: "custom" }
      : null;
  const coordinates = placeCoordinateAttributes(place);
  return `<article class="places-post">
    <button type="button" class="places-post-main" data-action="open-post" data-post-id="${esc(post.id)}" aria-label="Open post${date ? ` from ${esc(date)}` : ""}">
      ${postPreview(post)}
    </button>
    <div class="places-post-detail">
      ${place && !hidePlace ? `<button type="button" class="places-post-location" data-action="select-place" data-place-id="${esc(place.id)}" data-place-label="${esc(place.label)}" data-place-source="${esc(place.source || "custom")}" ${coordinates}>${esc(place.label)}</button>` : ""}
      ${caption ? `<p class="places-post-caption">${esc(caption)}</p>` : ""}
      <div class="places-post-byline">
        ${authorId
          ? `<button type="button" class="places-post-author" data-place-profile="${esc(authorId)}" aria-label="Open ${esc(authorName)}’s profile">
              ${avatar ? `<img ${avatar} alt="" loading="lazy" decoding="async">` : ""}
              <span>${esc(authorName)}</span>
            </button>`
          : `<span class="places-post-author">${avatar ? `<img ${avatar} alt="" loading="lazy" decoding="async">` : ""}<span>${esc(authorName)}</span></span>`}
        ${postRatingMarkup(post)}
        <span class="places-post-stats" aria-label="${number(likes)} likes"><span aria-hidden="true">♡</span> ${number(likes)}</span>
      </div>
      ${date ? `<span class="places-post-date">${esc(date)}</span>` : ""}
    </div>
  </article>`;
}

function coverMediaMarkup({ profile, coverPost, posts, label }) {
  if (profile?.coverReference) {
    const isVideo = profile.coverType === "video";
    const attrs = mediaSourceAttributes(profile.coverReference, profile.coverOwnerId || "");
    if (attrs) return isVideo && !profile.coverThumbnail
      ? `<video ${attrs} muted playsinline preload="metadata" aria-label="Video shared at ${esc(label)}"></video><span class="places-post-type">${icon("video")}<span class="sr-only">Video</span></span>`
      : `<img ${attrs} alt="${isVideo ? "Video" : "Photo"} shared at ${esc(label)}" decoding="async">${isVideo ? `<span class="places-post-type">${icon("video")}<span class="sr-only">Video</span></span>` : ""}`;
  }
  const withMedia = post => post?.id && post.kind !== "text" && Array.isArray(post.media) && post.media.length;
  const candidate = withMedia(coverPost) ? coverPost
    : [...(Array.isArray(posts) ? posts : [])].filter(withMedia).sort((x, y) => (Number(y.likeCount) || 0) - (Number(x.likeCount) || 0))[0];
  if (!candidate) return "";
  const preview = postPreview(candidate);
  return preview.includes("places-post-media") ? preview.replace('class="places-post-media"', 'class="places-post-media place-cover-inner"') : "";
}

function profileSummary({ place, profile, profileLoading, profileError, label, coverPost, posts }) {
  const p = { ...(place || {}), ...(profile?.place || {}) };
  const city = placeCity(p);
  const metaLine = [p.category, city && city !== (p.label || label) ? city : ""].filter(Boolean);
  const postCount = Number(profile?.postCount) || 0;
  const peopleCount = Number(profile?.peopleCount) || 0;
  const ratingCount = Number(profile?.ratingCount) || 0;
  const avg = ratingValue(profile?.averageRating);
  const point = placeCoordinates(p);
  const directions = point ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${encodeURIComponent(`${point.lat},${point.lon}`)}` : "";
  const cover = coverMediaMarkup({ profile, coverPost, posts, label });
  const stats = [];
  if (profile?.canRate) stats.push(avg !== null && ratingCount
    ? `<span class="place-profile-rating" data-testid="text-place-rating">${starRow(avg)}<b>${esc(avg.toFixed(1))}</b> (${number(ratingCount)})</span>`
    : `<span class="place-profile-rating is-empty" data-testid="text-place-rating">No ratings yet</span>`);
  if (profile) {
    stats.push(`<span data-testid="text-place-post-count"><b>${number(postCount)}</b> ${postCount === 1 ? "post" : "posts"}</span>`);
    stats.push(`<span data-testid="text-place-people-count"><b>${number(peopleCount)}</b> ${peopleCount === 1 ? "person" : "people"}</span>`);
  }
  const saved = Boolean(profile?.saved);
  return `<div class="place-profile-head">
    <div class="place-profile-ident">
      <span class="place-cover" data-testid="img-place-cover">${cover || icon("pin")}</span>
      <div class="place-profile-copy">
        <h1 id="place-detail-heading" data-testid="text-place-name">${esc(p.label || label)}</h1>
        ${metaLine.length ? `<p class="place-profile-meta" data-testid="text-place-category">${metaLine.map(esc).join(" · ")}</p>` : ""}
        ${stats.length ? `<p class="place-profile-counts">${stats.join('<span aria-hidden="true">·</span>')}</p>` : profileLoading ? `<p class="place-profile-counts" role="status"><span class="places-state-line short"></span></p>` : ""}
      </div>
    </div>
    ${profileError ? `<p class="place-profile-error" role="alert">${esc(profileError)}</p>` : ""}
    <div class="place-profile-actions">
      <button type="button" class="place-post-here" data-place-post data-testid="button-place-post-here" data-place-id="${esc(p.id || "")}" data-place-label="${esc(p.label || label)}" data-place-source="${esc(p.source || "custom")}" ${placeCoordinateAttributes(p)}>Post here</button>
      <button type="button" class="place-action" data-place-save data-place-id="${esc(p.id || "")}" aria-pressed="${saved}" data-testid="button-place-save" ${profile ? "" : "disabled"}>${saved ? "Saved" : "Save"}</button>
      ${directions ? `<a class="place-action" data-place-directions href="${esc(directions)}" data-place-lat="${esc(point.lat)}" data-place-lon="${esc(point.lon)}" target="_blank" rel="noopener noreferrer" data-testid="link-place-directions">Directions</a>` : ""}
      <button type="button" class="place-action" data-place-share data-place-id="${esc(p.id || "")}" data-place-label="${esc(p.label || label)}" data-testid="button-place-share">Share</button>
    </div>
  </div>`;
}

function tipsPanel(profile, reviewSaving, profileLoading) {
  if (!profile) return profileLoading ? statusMarkup({ loading: true, noun: "tips" }) : "";
  const source = String(profile.place?.source || "");
  const reviews = Array.isArray(profile.reviews) ? profile.reviews.filter(r => r?.id) : [];
  if (profile.canRate) return `<section class="place-reviews" aria-label="Ratings and tips">${reviewForm(profile, reviewSaving)}${tipsList(profile)}</section>`;
  const note = source === "custom" ? `<p class="place-review-note" data-testid="text-place-cannot-rate">Choose a place from search when posting to add a map pin.</p>` : "";
  return `<section class="place-reviews" aria-label="Tips">${note}${reviews.length ? tipsList(profile) : note ? "" : `<p class="place-review-note">No tips for this area.</p>`}</section>`;
}

function peopleList(profile) {
  const people = Array.isArray(profile?.people) ? profile.people.filter(person => person?.id) : [];
  if (!people.length) return `<div class="places-state"><strong>No people yet</strong><p>Members who post here will appear in this list.</p></div>`;
  return `<ul class="place-people" aria-label="People who posted here">${people.map(person => `<li><button type="button" class="place-person" data-place-profile="${esc(person.id)}" data-testid="button-place-person-${esc(person.id)}">
      ${personAvatar(person)}
      <span class="place-person-copy"><b>${esc(personName(person))}</b>${person.username ? `<small>@${esc(person.username)}</small>` : ""}</span>
    </button></li>`).join("")}</ul>
    ${profile.peopleHasMore ? `<div class="places-more"><button type="button" data-place-people-more data-offset="${esc(profile.peopleNextOffset ?? "")}" data-testid="button-place-people-more">Load more people</button></div>` : ""}`;
}

function reviewForm(profile, reviewSaving) {
  if (!profile) return "";
  if (!profile.canRate) {
    return `<p class="place-review-note" data-testid="text-place-cannot-rate">Ratings and tips are available for mapped places. Custom place tags can’t be rated.</p>`;
  }
  const own = profile.ownReview || null;
  const current = Number(own?.rating) || 0;
  const ownTags = Array.isArray(own?.tags) ? own.tags : [];
  return `<form class="place-review-form" data-place-review-form data-testid="form-place-review">
    <fieldset class="place-review-stars">
      <legend>${own ? "Your rating and comment" : "Rate and comment"}</legend>
      <div class="place-review-star-inputs">${[5, 4, 3, 2, 1].map(n => `<label class="place-review-star"><input type="radio" name="rating" value="${n}" required ${n === current ? "checked" : ""} data-testid="radio-place-rating-${n}"><span aria-hidden="true">★</span><span class="sr-only">${n} ${n === 1 ? "star" : "stars"}</span></label>`).join("")}</div>
    </fieldset>
    <label class="place-review-tip"><span>Tip <small>optional</small></span><textarea name="tip" maxlength="200" rows="2" placeholder="What should people know?" data-testid="input-place-tip">${esc(own?.tip || "")}</textarea></label>
    <fieldset class="place-review-tags"><legend>Tags</legend><div>${REVIEW_TAGS.map(tag => `<label class="place-review-tag"><input type="checkbox" name="tags" value="${esc(tag)}" ${ownTags.includes(tag) ? "checked" : ""}><span>${esc(tag)}</span></label>`).join("")}</div></fieldset>
    <button type="submit" class="place-review-submit" data-testid="button-place-review-save" ${reviewSaving ? "disabled aria-busy=\"true\"" : ""}>${reviewSaving ? "Saving…" : own ? "Update review" : "Save review"}</button>
  </form>`;
}

function tipsList(profile) {
  const reviews = Array.isArray(profile?.reviews) ? profile.reviews.filter(review => review?.id) : [];
  if (!reviews.length) return `<p class="place-review-note">No tips yet.</p>`;
  return `<ul class="place-tips" aria-label="Tips">${reviews.map(review => {
    const author = review.author || {};
    const tags = Array.isArray(review.tags) ? review.tags.filter(Boolean) : [];
    const date = dateLabel(review.updatedAt || review.createdAt);
    return `<li class="place-tip" data-testid="card-place-review-${esc(review.id)}">
      <div class="place-tip-head">
        ${author.id ? `<button type="button" class="place-tip-author" data-place-profile="${esc(author.id)}">${personAvatar(author, "place-tip-avatar")}<b>${esc(personName(author))}</b></button>` : `<span class="place-tip-author">${personAvatar(author, "place-tip-avatar")}<b>${esc(personName(author))}</b></span>`}
        ${starRow(review.rating)}
      </div>
      ${review.tip ? `<p class="place-tip-text">${esc(review.tip)}</p>` : ""}
      ${tags.length ? `<p class="place-tip-tags">${tags.map(tag => `<span>${esc(tag)}</span>`).join("")}</p>` : ""}
      <div class="place-tip-foot">${date ? `<span>${esc(date)}</span>` : "<span></span>"}<button type="button" class="place-tip-report" data-place-review-report="${esc(review.id)}" data-testid="button-report-review-${esc(review.id)}">Report</button></div>
    </li>`;
  }).join("")}</ul>
  ${profile.reviewsHasMore ? `<div class="places-more"><button type="button" data-place-tips-more data-offset="${esc(profile.reviewsNextOffset ?? "")}" data-testid="button-place-tips-more">More tips</button></div>` : ""}`;
}

const relativeTime = value => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  if (minutes < 10080) return `${Math.round(minutes / 1440)}d`;
  return dateLabel(value);
};
const captionWithTags = text => esc(text).replace(/(^|\s)#([\p{L}\p{N}_]{1,60})/gu, '$1<span class="place-feed-tag">#$2</span>');

function feedMedia(post) {
  const preview = postPreview(post);
  return preview.includes("places-post-media") ? preview : "";
}

// Rich post card for Places feeds. personForPost(post) may return {id,username,displayName,avatar}.
export function placeFeedCard(post, { personForPost = null, showPlace = true, showRating = true } = {}) {
  if (!post?.id) return "";
  const resolved = typeof personForPost === "function" ? personForPost(post) : null;
  const author = { ...(post.author || {}), ...(resolved || {}) };
  const authorId = String(author.id || "");
  const name = personName(author);
  const caption = String(post.caption || post.text || "").trim();
  const time = relativeTime(post.created ?? post.createdAt);
  const likes = Number(post.likeCount) || 0;
  const commentsCount = Number(post.commentCount) || 0;
  const liked = Boolean(post.liked ?? post.likedByMe);
  const media = feedMedia(post);
  const place = post.place?.id && post.place?.label ? post.place : null;
  const rating = showRating && post.placeRating ? placeRatingInfo(post) : null;
  const pid = esc(post.id);
  const chips = [
    showPlace && place ? `<button type="button" class="place-feed-chip" data-action="select-place" data-place-id="${esc(place.id)}" data-place-label="${esc(place.label)}" data-place-source="${esc(place.source || "custom")}" ${placeCoordinateAttributes(place)}>${icon("pin")}<span>${esc(place.label)}</span></button>` : "",
    rating ? `<span class="place-feed-chip is-static" aria-label="Place rated ${esc(rating.avg.toFixed(1))} out of 5 from ${number(rating.count)} ${rating.count === 1 ? "rating" : "ratings"}"><span class="place-feed-star" aria-hidden="true">★</span><span aria-hidden="true">${esc(rating.avg.toFixed(1))} (${number(rating.count)})</span></span>` : "",
  ].filter(Boolean).join("");
  return `<article class="place-feed-card${media ? "" : " is-text"}" data-post-id="${pid}" data-testid="card-place-post-${pid}">
    <button type="button" class="place-feed-open" data-action="open-post" data-post-id="${pid}" aria-label="Open post by ${esc(name)}"></button>
    ${media ? `<div class="place-feed-media" aria-hidden="true">${media}</div>` : ""}
    <div class="place-feed-panel">
      <div class="place-feed-byline">
        ${authorId ? `<button type="button" class="place-feed-author" data-place-profile="${esc(authorId)}" aria-label="Open ${esc(name)}’s profile">${personAvatar(author, "place-feed-avatar")}<b>${esc(name)}</b></button>` : `<span class="place-feed-author">${personAvatar(author, "place-feed-avatar")}<b>${esc(name)}</b></span>`}
        ${time ? `<time class="place-feed-time" datetime="${esc(post.created ?? post.createdAt)}">${esc(time)}</time>` : ""}
      </div>
      ${caption ? `<p class="place-feed-caption">${captionWithTags(caption)}</p>` : ""}
      ${chips ? `<div class="place-feed-chips">${chips}</div>` : ""}
      <div class="place-feed-actions">
        <button type="button" class="place-feed-act${liked ? " is-on" : ""}" data-place-post-like="${pid}" aria-pressed="${liked}" aria-label="${liked ? "Unlike" : "Like"} post, ${number(likes)} likes">${icon("heart")}<span>${number(likes)}</span></button>
        <button type="button" class="place-feed-act" data-place-post-comment="${pid}" aria-label="Comments, ${number(commentsCount)}">${icon("comment")}<span>${number(commentsCount)}</span></button>
        <button type="button" class="place-feed-act" data-place-post-share="${pid}" aria-label="Share post">${icon("share")}</button>
      </div>
      <button type="button" class="place-feed-comment" data-place-post-comment="${pid}">${commentsCount ? "Add a comment…" : "Be the first to comment"}</button>
    </div>
  </article>`;
}

export function renderPlaceDetail({
  place = null, posts = [], loading = false, loadingMore = false, error = false,
  moreError = false, hasMore = false, attribution = null,
  mapVisible = false, returnToPlaces = false,
  profile = null, profileLoading = false, profileError = "", profileTab = "top", reviewSaving = false,
  coverPost = null, personForPost = null,
} = {}) {
  const label = place?.label || profile?.place?.label || "Place";
  const tab = ["top", "recent", "people", "tips"].includes(profileTab) ? profileTab : "top";
  const rawItems = Array.isArray(posts) ? posts.filter(post => post?.id) : [];
  const items = tab === "recent"
    ? [...rawItems].sort((a, b) => new Date(b.created ?? b.createdAt).getTime() - new Date(a.created ?? a.createdAt).getTime())
    : [...rawItems].sort((a, b) => (Number(b.likeCount) || 0) - (Number(a.likeCount) || 0));
  const postState = statusMarkup({
    loading,
    error: error && !items.length,
    empty: !loading && !items.length ? { title: "Nothing shared here yet", copy: "Posts tagged at this location will appear here." } : null,
    noun: "posts",
  });
  const hasCoordinates = placeCoordinates(place) !== null;
  const tabs = [["top", "Top"], ["recent", "Recent"], ["people", "People"], ["tips", "Tips"]];
  let tabBody;
  if (tab === "people") tabBody = profileLoading && !profile ? statusMarkup({ loading: true, noun: "people" }) : profile ? peopleList(profile) : "";
  else if (tab === "tips") tabBody = tipsPanel(profile, reviewSaving, profileLoading);
  else tabBody = `${postState || `<div class="place-feed-list" aria-label="Posts from ${esc(label)}">${items.map(post => placeFeedCard(post, { personForPost })).join("")}</div>`}
        ${error || moreError ? `<div class="places-more"><button type="button" data-action="retry-place-feed">Try again</button></div>` : ""}
        ${hasMore ? `<div class="places-more"><button type="button" data-action="load-more" ${loadingMore ? "disabled" : ""}>${loadingMore ? "Loading…" : "Load more"}</button></div>` : ""}`;
  return `<section class="places-view places-detail ${mapVisible ? "is-map-revealed" : ""}" aria-labelledby="place-detail-heading">
    ${hasCoordinates ? `<div class="places-map-backdrop" aria-hidden="${mapVisible ? "false" : "true"}" ${mapVisible ? "" : "hidden"}>
      <div class="places-map-card">
        <div class="places-map" data-place-detail-map data-place-id="${esc(place.id)}" aria-label="Map showing ${esc(label)}"></div>
        <p class="places-map-status" data-place-map-status role="status">Loading map…</p>
      </div>
      ${attributionMarkup(attribution)}
    </div>` : ""}
    <div class="place-grid-sheet">
      ${hasCoordinates ? `<button type="button" class="place-map-grabber" data-place-map-handle aria-label="${mapVisible ? "Hide map" : "Reveal map"}" aria-expanded="${mapVisible}"><span aria-hidden="true"></span></button>` : ""}
      <header class="place-detail-heading">
        <button type="button" class="place-detail-back" data-action="${returnToPlaces ? "back-to-places" : "back-to-home"}" aria-label="${returnToPlaces ? "Back to Places" : "Back to Home"}">${icon("back")}<span class="sr-only">${returnToPlaces ? "Back to Places" : "Back to Home"}</span></button>
        <span class="place-detail-heading-spacer" aria-hidden="true"></span>
      </header>
      <div class="place-detail-scroll">
        ${profileSummary({ place, profile, profileLoading, profileError, label, coverPost, posts: rawItems })}
        <div class="place-profile-tabs" role="tablist" aria-label="Place sections">${tabs.map(([key, text]) => `<button type="button" role="tab" class="place-profile-tab" data-place-tab="${key}" aria-selected="${tab === key}" data-testid="tab-place-${key}">${text}</button>`).join("")}</div>
        <div class="place-profile-panel" role="tabpanel">${tabBody}</div>
      </div>
    </div>
  </section>`;
}
