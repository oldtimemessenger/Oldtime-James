// Community post media: layout decisions, attachment grid markup and composer attachment rules.
// Pure functions only — the app binds events and performs uploads.

export const COMMUNITY_MAX_ATTACHMENTS = 6;
export const COMMUNITY_GRID_VISIBLE = 6;

/** Shared MIME / normalized-type classifier: "video/mp4; codecs=..", "video", "image/png", "photo", "image". */
export function attachmentKind(type = "") {
  const value = String(type || "").trim().toLowerCase().split(";")[0].trim();
  if (value.startsWith("video/") || value === "video") return "video";
  if (value.startsWith("image/") || value === "image" || value === "photo") return "photo";
  return "";
}

/** True when the post declares at least one video attachment (or is a legacy video post). */
export function postHasVideo(post) {
  return post?.kind === "video" || (Array.isArray(post?.mediaTypes) && post.mediaTypes.some(type => attachmentKind(type) === "video"));
}

/** Per-attachment items. Uses mediaTypes from the cloud contract; falls back to post.kind for legacy posts. */
export function communityMediaItems(post, references = []) {
  const types = Array.isArray(post?.mediaTypes) ? post.mediaTypes : [];
  const posters = Array.isArray(post?.mediaPosters) ? post.mediaPosters : [];
  return references.map((source, index) => {
    const declared = attachmentKind(types[index]);
    const video = declared ? declared === "video" : (post?.kind === "video" && index === 0);
    return { source, index, video, poster: posters[index] || "" };
  });
}

/** "video-card" only for exactly one video and nothing else; otherwise a grid (or nothing). */
export function communityMediaLayout(items = []) {
  if (!items.length) return "none";
  if (items.length === 1 && items[0].video) return "video-card";
  return "grid";
}

export function commentPromptLabel(count) {
  return Number(count) > 0 ? "Add a comment" : "Be the first to comment";
}

/**
 * Twitter-style attachment grid. Author/caption are NOT repeated per tile.
 * deps: { esc, sourceAttr(source), posterAttr(poster), playIcon, handle, alt }
 */
export function communityGridMarkup(postId, items, deps) {
  const { esc, sourceAttr, posterAttr = () => "", playIcon = "", handle = "member", alt = "Community post photo" } = deps;
  const visible = items.slice(0, COMMUNITY_GRID_VISIBLE);
  const hidden = items.length - visible.length;
  const tiles = visible.map((item, position) => {
    const label = `Open ${item.video ? "video" : "photo"} ${item.index + 1} of ${items.length} by @${handle}`;
    const preview = item.video
      ? `<video ${sourceAttr(item.source)} ${posterAttr(item.poster)} muted playsinline preload="metadata" aria-hidden="true"></video><span class="community-grid-play" aria-hidden="true">${playIcon}</span>`
      : `<img ${sourceAttr(item.source)} alt="${esc(alt)}" loading="lazy" decoding="async" />`;
    const more = hidden > 0 && position === visible.length - 1 ? `<span class="community-grid-more" aria-hidden="true">+${hidden}</span>` : "";
    return `<button type="button" class="community-grid-tile${item.video ? " is-video" : ""}" data-stories-post="${esc(postId)}" data-media-index="${item.index}" aria-label="${esc(label)}">${preview}${more}</button>`;
  }).join("");
  return `<div class="community-attachment-grid" data-count="${visible.length}" aria-label="${items.length} attachment${items.length === 1 ? "" : "s"}">${tiles}</div>`;
}

/**
 * Merge newly chosen files into the composer list. Never silently drops anything:
 * every refused file is returned with a reason.
 */
export function addComposerFiles(current = [], files = [], max = COMMUNITY_MAX_ATTACHMENTS) {
  const next = [...current];
  const rejected = [];
  for (const file of Array.from(files || [])) {
    const kind = attachmentKind(file?.type);
    if (!kind) { rejected.push({ name: file?.name || "File", reason: "type" }); continue; }
    if (next.length >= max) { rejected.push({ name: file?.name || "File", reason: "limit" }); continue; }
    next.push({ file, kind });
  }
  return { next, rejected };
}

export function rejectionMessage(rejected = [], max = COMMUNITY_MAX_ATTACHMENTS) {
  if (!rejected.length) return "";
  const limit = rejected.filter(item => item.reason === "limit").map(item => item.name);
  const type = rejected.filter(item => item.reason === "type").map(item => item.name);
  const parts = [];
  if (limit.length) parts.push(`A post holds up to ${max} photos or videos. Not added: ${limit.join(", ")}.`);
  if (type.length) parts.push(`Only photos and videos can be attached. Not added: ${type.join(", ")}.`);
  return parts.join(" ");
}

export function moveAttachment(list = [], from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
