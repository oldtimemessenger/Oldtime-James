// Frees decoder/player resources of posted-media <video> elements that are about to be discarded.
// Scope is deliberately narrow: only feed/post/grid preview videos. Never touches the floating
// mini-player, camera/studio/creation previews, live streams (srcObject) or opted-out nodes.
export const POST_VIDEO_SELECTOR = [
  ".clip video", ".community-post-card video", ".community-attachment-grid video", ".post-carousel video",
  ".explore-feed-video", ".places-post-video", ".profile-presentation video", ".cvc-stage video",
].join(",");
const PROTECTED = ".ot-video-float, [data-keep-media], .creative-editor, .camera-feed, .studio, .rs-result, .bvn-camera-lens";

export function shouldReleaseVideo(video) {
  if (!video || video.tagName !== "VIDEO") return false;
  if (video.closest?.(PROTECTED)) return false;
  if (video.srcObject) return false; // live camera/canvas stream owned elsewhere
  if (!video.matches?.(POST_VIDEO_SELECTOR)) return false;
  return Boolean(video.getAttribute("src") || video.querySelector?.("source[src]"));
}

export function releaseVideo(video) {
  if (!shouldReleaseVideo(video)) return false;
  try { video.pause(); } catch {}
  video.removeAttribute("src");
  video.querySelectorAll?.("source").forEach(source => source.removeAttribute("src"));
  try { video.srcObject = null; } catch {}
  try { video.load(); } catch {}
  return true;
}

/** Release post videos inside a subtree that is being removed. Returns released count. */
export function releasePostVideos(root) {
  if (!root) return 0;
  const list = root.tagName === "VIDEO" ? [root] : [...(root.querySelectorAll?.("video") || [])];
  let count = 0;
  for (const video of list) if (releaseVideo(video)) count++;
  return count;
}
