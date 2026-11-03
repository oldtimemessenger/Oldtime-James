export function installVideoMediaSession({
  root = globalThis.document,
  mediaSession = globalThis.navigator?.mediaSession,
  Metadata = globalThis.MediaMetadata,
  baseURI = globalThis.document?.baseURI,
} = {}) {
  if (!root?.addEventListener || !mediaSession || typeof Metadata !== "function" || !baseURI) {
    return () => {};
  }

  let activeVideo = null;
  const onPlay = event => {
    const video = event.target;
    if (video?.tagName !== "VIDEO" || video.srcObject || !(video.currentSrc || video.src)) return;

    try {
      activeVideo = video;
      mediaSession.metadata = new Metadata({
        title: "Video",
        artist: "Oldtime",
        artwork: [{
          src: new URL("app-icon-512.png", baseURI).href,
          sizes: "512x512",
          type: "image/png",
        }],
      });
      mediaSession.playbackState = "playing";
    } catch {
      activeVideo = null;
    }
  };
  const onPause = event => {
    if (event.target === activeVideo) mediaSession.playbackState = "paused";
  };
  const onEnded = event => {
    if (event.target !== activeVideo) return;
    mediaSession.playbackState = "none";
    mediaSession.metadata = null;
    activeVideo = null;
  };

  root.addEventListener("play", onPlay, true);
  root.addEventListener("pause", onPause, true);
  root.addEventListener("ended", onEnded, true);

  return () => {
    root.removeEventListener("play", onPlay, true);
    root.removeEventListener("pause", onPause, true);
    root.removeEventListener("ended", onEnded, true);
    if (activeVideo) {
      mediaSession.playbackState = "none";
      mediaSession.metadata = null;
      activeVideo = null;
    }
  };
}
