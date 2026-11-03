export const FEED_VIDEO_PREFETCH_ROOT_MARGIN = "0px 0px 320px 0px";

// Avoid background video transfers when the browser signals a constrained connection.
// Playback itself remains available when the viewer reaches the video.
export function shouldPrefetchFeedVideo(connection = globalThis.navigator?.connection) {
  if (!connection) return true;
  if (connection.saveData === true) return false;
  return !["slow-2g", "2g"].includes(String(connection.effectiveType || "").toLowerCase());
}

export async function prefetchFeedVideoMetadata(video, loadLocalVideo) {
  if (!video?.isConnected || !video.dataset) return false;
  if (["pending", "ready"].includes(video.dataset.feedInitialBufferPrefetched)) return false;

  const localReference = String(video.dataset.localMedia || "");
  video.dataset.feedInitialBufferPrefetched = "pending";
  video.preload = "auto";

  try {
    let source = video.currentSrc || video.getAttribute?.("src") || "";
    let loadedLocalSource = false;
    if (!source && localReference.startsWith("oldtime-media:")) {
      if (typeof loadLocalVideo !== "function") throw new Error("A local media loader is required.");
      const loaded = await loadLocalVideo(video, { quiet: true });
      if (!loaded) throw new Error("The local media URL could not be prepared.");
      source = video.currentSrc || video.getAttribute?.("src") || "";
      video.preload = "auto";
      loadedLocalSource = true;
    }
    if (
      typeof source !== "string" ||
      !source ||
      !video.isConnected ||
      (localReference && video.dataset.localMedia !== localReference)
    ) {
      delete video.dataset.feedInitialBufferPrefetched;
      return false;
    }

    if (!video.getAttribute?.("src")) video.src = source;
    if (!loadedLocalSource && video.readyState < 1 && (video.currentSrc || video.getAttribute?.("src"))) video.load();
    video.dataset.feedInitialBufferPrefetched = "ready";
    video.addEventListener?.("error", () => {
      if (video.dataset.feedInitialBufferPrefetched === "ready") {
        delete video.dataset.feedInitialBufferPrefetched;
      }
    }, { once: true });
    return true;
  } catch {
    if (video.dataset.feedInitialBufferPrefetched === "pending") {
      delete video.dataset.feedInitialBufferPrefetched;
    }
    return false;
  }
}
