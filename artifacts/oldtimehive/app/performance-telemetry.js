const MAX_DURATION_MS = 120_000;
const FEED_METRICS = new Set(["fetchMs", "renderMs", "totalMs", "workerMs", "rowsMs", "hydrateMs", "rankMs"]);
const VIDEO_METRICS = new Set(["urlMs", "activeToFrameMs", "playCallMs"]);
const SERVER_TIMING_NAMES = new Map([
  ["worker", "workerMs"],
  ["feed_rows", "rowsMs"],
  ["feed_hydrate", "hydrateMs"],
  ["feed_rank", "rankMs"],
]);

const CAPTURE_STORAGE_KEY = "oldtime.performanceCapture.v1";
const CAPTURE_TTL_MS = 10 * 60 * 1000;
const CAPTURE_EVENT_LIMIT = 12;
const RANDOM_CLIENT_PERFORMANCE_SAMPLE = Math.random() < 0.25;

function parseCaptureState(value, now) {
  if (typeof value !== "string") return null;
  try {
    const state = JSON.parse(value);
    if (!Number.isFinite(state?.expiresAt) || !Number.isInteger(state?.remaining) ||
        state.remaining < 1 || state.expiresAt <= now) return null;
    return { expiresAt: state.expiresAt, remaining: state.remaining };
  } catch {
    return null;
  }
}

export function createOptInPerformanceCapture({ search = "", storage = null, now = () => Date.now() } = {}) {
  let state = null;
  const fromQuery = new URLSearchParams(search).get("perf_capture") === "1";
  let optInSession = fromQuery;
  try {
    if (fromQuery) {
      state = { expiresAt: now() + CAPTURE_TTL_MS, remaining: CAPTURE_EVENT_LIMIT };
      storage?.setItem(CAPTURE_STORAGE_KEY, JSON.stringify(state));
    } else {
      state = parseCaptureState(storage?.getItem(CAPTURE_STORAGE_KEY), now());
      optInSession = state !== null;
      if (!state) storage?.removeItem(CAPTURE_STORAGE_KEY);
    }
  } catch {
    // An explicit URL opt-in still works in memory if session storage is unavailable.
    if (!fromQuery) state = null;
  }

  const clear = () => {
    state = null;
    try {
      storage?.removeItem(CAPTURE_STORAGE_KEY);
    } catch {}
  };
  const isActive = () => {
    if (!state || state.expiresAt <= now() || state.remaining < 1) {
      clear();
      return false;
    }
    return true;
  };

  return {
    activatedFromQuery: fromQuery && state !== null,
    isOptInSession: () => optInSession,
    isActive,
    consume() {
      if (!isActive()) return false;
      state = { ...state, remaining: state.remaining - 1 };
      if (state.remaining < 1) {
        clear();
      } else {
        try {
          storage?.setItem(CAPTURE_STORAGE_KEY, JSON.stringify(state));
        } catch {}
      }
      return true;
    },
  };
}

function getSessionStorage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

const optInCapture = createOptInPerformanceCapture({
  search: globalThis.location?.search ?? "",
  storage: getSessionStorage(),
});

if (optInCapture.activatedFromQuery && globalThis.location && globalThis.history?.replaceState) {
  try {
    const url = new URL(globalThis.location.href);
    url.searchParams.delete("perf_capture");
    globalThis.history.replaceState(globalThis.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {}
}

export function shouldMeasureClientPerformance() {
  return optInCapture.isOptInSession()
    ? optInCapture.isActive()
    : RANDOM_CLIENT_PERFORMANCE_SAMPLE;
}

function boundedDuration(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_DURATION_MS
    ? Math.round(value / 10) * 10
    : null;
}

export function readFeedServerTimings(entries, startedAt, pageOrigin = globalThis.location?.origin || "") {
  if (!Array.isArray(entries)) return {};
  const resource = [...entries].reverse().find(entry => {
    if (!entry || !Number.isFinite(entry.startTime) || entry.startTime < startedAt - 1) return false;
    try {
      const url = new URL(entry.name, pageOrigin || "https://oldtime.invalid");
      return (!pageOrigin || url.origin === pageOrigin) && url.pathname.endsWith("/api/feed");
    } catch {
      return false;
    }
  });
  if (!resource || !Array.isArray(resource.serverTiming)) return {};

  const metrics = {};
  for (const timing of resource.serverTiming) {
    const key = SERVER_TIMING_NAMES.get(timing?.name);
    const duration = boundedDuration(timing?.duration);
    if (key && duration !== null) metrics[key] = duration;
  }
  return metrics;
}

export function sanitizeClientPerformanceEvent(event, metrics, outcome, frameSignal) {
  const allowedMetrics = event === "feed" ? FEED_METRICS : event === "video" ? VIDEO_METRICS : null;
  const allowedOutcomes = event === "feed"
    ? new Set(["success", "failure"])
    : event === "video"
      ? new Set(["frame", "play-rejected", "media-error", "timeout", "url-error"])
      : null;
  if (!allowedMetrics || !allowedOutcomes.has(outcome) || !metrics || typeof metrics !== "object") return null;
  if (frameSignal !== undefined && !["video-frame", "loadeddata", "none"].includes(frameSignal)) return null;

  const safeMetrics = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (!allowedMetrics.has(key)) continue;
    const duration = boundedDuration(value);
    if (duration !== null) safeMetrics[key] = duration;
  }
  if (!Object.keys(safeMetrics).length) return null;
  return { event, outcome, metrics: safeMetrics, ...(frameSignal ? { frameSignal } : {}) };
}

export function reportClientPerformance(request, event, metrics, outcome, frameSignal) {
  const payload = sanitizeClientPerformanceEvent(event, metrics, outcome, frameSignal);
  if (!shouldMeasureClientPerformance() || !payload || typeof request !== "function") return;
  if (optInCapture.isOptInSession()) optInCapture.consume();
  try {
    void Promise.resolve(request("/performance/client", {
      method: "POST",
      body: payload,
      timeoutMs: 5000,
    })).catch(() => {});
  } catch {
    // Measurement must never delay or disrupt feed/video playback.
  }
}
