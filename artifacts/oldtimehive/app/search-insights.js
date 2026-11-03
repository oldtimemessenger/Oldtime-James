// Search Insights: playback-backed Search click learning and lazy per-card insight lookup.
// Nothing here is persisted in the browser; search phrases are only sent to the Oldtime API.
export const SEARCH_WATCH_THRESHOLD_SECONDS = 5;
const MAX_STEP_SECONDS = 1.5; // larger forward jumps are seeks or throttled timers, not playback
const MEDIA_EVENTS = ["playing", "timeupdate", "pause", "waiting", "stalled", "seeking", "seeked", "ended", "emptied", "ratechange"];

export function normalizeSearchPhrase(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

// The server stores whole seconds and requires more than five, so only whole seconds count.
export function qualifyingWatchSeconds(seconds) {
  const whole = Math.floor(Number(seconds));
  return Number.isFinite(whole) && whole > SEARCH_WATCH_THRESHOLD_SECONDS && whole <= 3600 ? whole : 0;
}

export function createSearchPlaybackTracker({ send, isVisible = () => typeof document === "undefined" || document.visibilityState === "visible" } = {}) {
  let session = null; // { query, owner, videos: Map<videoId, { watched, status }> }
  const cursors = new WeakMap(); // element -> last observed currentTime while actively playing

  const entryFor = videoId => {
    let entry = session.videos.get(videoId);
    if (!entry) session.videos.set(videoId, entry = { watched: 0, status: "idle" });
    return entry;
  };

  function start(query, owner = "") {
    const phrase = normalizeSearchPhrase(query);
    if (!phrase) { session = null; return false; }
    if (session?.query.toLowerCase() !== phrase.toLowerCase() || session.owner !== owner) session = { query: phrase, owner, videos: new Map() };
    return true;
  }
  const stop = () => { session = null; };

  function submit(videoId, entry) {
    const seconds = qualifyingWatchSeconds(entry.watched);
    if (!seconds || entry.status !== "idle") return;
    entry.status = "sending"; // never retried: a failed attempt cannot produce a duplicate later
    const target = session;
    Promise.resolve().then(() => send({ videoId, queryText: target.query, watchTimeSeconds: seconds }))
      .then(() => { entry.status = "sent"; }, () => { entry.status = "failed"; });
  }

  function handle(event, getVideoId) {
    const video = event.target;
    if (!session || !video || video.tagName !== "VIDEO") return;
    const videoId = getVideoId(video);
    if (!videoId) { cursors.delete(video); return; }
    if (event.type !== "timeupdate" && event.type !== "playing") { cursors.delete(video); return; }
    const playing = !video.paused && !video.ended && !video.seeking && video.readyState >= 2 && isVisible();
    if (!playing) { cursors.delete(video); return; }
    const time = Number(video.currentTime);
    if (!Number.isFinite(time)) { cursors.delete(video); return; }
    const last = cursors.get(video);
    cursors.set(video, time);
    if (event.type === "playing" || last === undefined) return;
    const step = (time - last) / (Number(video.playbackRate) > 0 ? Number(video.playbackRate) : 1);
    if (!(step > 0) || step > MAX_STEP_SECONDS) return;
    const entry = entryFor(videoId);
    if (entry.status !== "idle") return;
    entry.watched += step;
    submit(videoId, entry);
  }

  // Media events do not bubble, so listen in the capture phase on the viewer feed.
  function bind(container, getVideoId) {
    const listener = event => handle(event, getVideoId);
    const onVisibility = () => { if (!isVisible()) container.querySelectorAll?.("video").forEach(video => cursors.delete(video)); };
    MEDIA_EVENTS.forEach(type => container.addEventListener(type, listener, true));
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
    return () => {
      MEDIA_EVENTS.forEach(type => container.removeEventListener(type, listener, true));
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
    };
  }

  return { start, stop, bind, query: () => session?.query || "", watched: videoId => session?.videos.get(videoId)?.watched || 0 };
}

export function createInsightLoader({ request, onChange, maxConcurrent = 2 } = {}) {
  const results = new Map(); // videoId -> { keyword } | null once resolved
  const state = new Set(); // requested ids (loading or resolved); one request per video
  const queue = [];
  let active = 0;
  let generation = 0;

  function pump() {
    while (active < maxConcurrent && queue.length) {
      const id = queue.shift();
      const mine = generation;
      active++;
      Promise.resolve().then(() => request(id)).then(value => {
        if (mine !== generation) return;
        const keyword = typeof value?.insight?.keyword === "string" ? value.insight.keyword.trim().slice(0, 120) : "";
        results.set(id, keyword ? { keyword } : null);
        if (keyword) onChange?.(id);
      }, () => { if (mine === generation) results.set(id, null); })
        .finally(() => { active--; pump(); });
    }
  }

  return {
    request(id) {
      if (!id || state.has(id)) return false;
      state.add(id);
      queue.push(id);
      pump();
      return true;
    },
    get: id => results.get(id) || null,
    reset() { generation++; results.clear(); state.clear(); queue.length = 0; },
  };
}
