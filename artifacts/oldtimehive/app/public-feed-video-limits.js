export const PUBLIC_FEED_VIDEO_MAX_SECONDS = 60;
export const PUBLIC_FEED_VIDEO_MAX_BYTES = 16 * 1024 * 1024;

export function publicFeedVideoLimitMessage({ visibility, destination, kind, durationSeconds, size }) {
  if (visibility !== "public" || !["main", "both"].includes(destination) || kind !== "video") return "";
  if (Number.isFinite(durationSeconds) && durationSeconds > PUBLIC_FEED_VIDEO_MAX_SECONDS) {
    return "Public feed videos must be 60 seconds or less. Trim the video and try again.";
  }
  if (Number.isFinite(size) && size > PUBLIC_FEED_VIDEO_MAX_BYTES) {
    return "Public feed videos must be 16 MB or smaller after compression. Trim or compress the video and try again.";
  }
  return "";
}
