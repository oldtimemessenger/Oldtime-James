// First-frame stills for public videos that have no poster.
// One decode at a time, viewport-lazy, small bounded cache, honest errors with retry.
// Real posters are always preferred by callers; this only runs when none exists.

export const STILL_CACHE_LIMIT = 40;
const STILL_WIDTH = 240;
const STILL_TIMEOUT_MS = 12_000;

export function saveDataOn(nav = globalThis.navigator) {
  return Boolean(nav?.connection?.saveData);
}

// Grabs one real decoded frame. Muted, inline, metadata preload, then fully disposed.
export function extractFirstFrame(url, { doc = globalThis.document, timeoutMs = STILL_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const video = doc.createElement("video");
    let done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.onloadeddata = video.onseeked = video.onerror = null;
      try { video.pause(); video.removeAttribute("src"); video.load(); } catch {}
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => finish(new Error("Preview timed out.")), timeoutMs);
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.onerror = () => finish(new Error("This video preview couldn’t load."));
    video.onloadeddata = () => {
      // Safari often has no painted frame at 0 until a seek; nudge slightly in.
      try { video.currentTime = Math.min(0.1, (video.duration || 1) / 2); } catch { finish(new Error("Preview seek failed.")); }
    };
    video.onseeked = () => {
      try {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) throw new Error("No video frame available.");
        const canvas = doc.createElement("canvas");
        canvas.width = STILL_WIDTH;
        canvas.height = Math.round(STILL_WIDTH * h / w);
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(null, canvas.toDataURL("image/jpeg", 0.72));
      } catch (error) {
        finish(error instanceof Error ? error : new Error("Preview unavailable."));
      }
    };
    video.src = url;
  });
}

export function createVideoStillQueue({ resolveUrl, extract = extractFirstFrame, limit = STILL_CACHE_LIMIT } = {}) {
  const cache = new Map(); // postId -> data URL (LRU order)
  const failed = new Map(); // postId -> message
  const waiting = []; // { id, ref }
  const listeners = new Set();
  let active = null;
  let generation = 0;

  const emit = (id, still, error) => listeners.forEach(fn => fn(id, still, error));
  const remember = (id, still) => {
    cache.delete(id);
    cache.set(id, still);
    while (cache.size > limit) cache.delete(cache.keys().next().value);
  };

  async function pump() {
    if (active || !waiting.length) return;
    const job = waiting.shift();
    active = job.id;
    const gen = generation;
    try {
      const url = await resolveUrl(job.ref);
      const still = await extract(url);
      if (gen !== generation) return;
      remember(job.id, still);
      failed.delete(job.id);
      emit(job.id, still, "");
    } catch (error) {
      if (gen !== generation) return;
      failed.set(job.id, error?.message || "Preview unavailable.");
      emit(job.id, "", failed.get(job.id));
    } finally {
      if (gen === generation) { active = null; pump(); }
    }
  }

  return {
    get(id) {
      if (!cache.has(id)) return "";
      const still = cache.get(id);
      remember(id, still);
      return still;
    },
    error: id => failed.get(id) || "",
    request(id, ref, { retry = false } = {}) {
      if (!id || !ref || cache.has(id) || active === id || waiting.some(job => job.id === id)) return false;
      if (failed.has(id) && !retry) return false;
      failed.delete(id);
      waiting.push({ id, ref });
      pump();
      return true;
    },
    cancel(id) {
      const index = waiting.findIndex(job => job.id === id);
      if (index >= 0) waiting.splice(index, 1);
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    clear() {
      generation++;
      cache.clear(); failed.clear(); waiting.length = 0; active = null;
    },
    stats: () => ({ cached: cache.size, waiting: waiting.length, active }),
  };
}

// Markup for a poster-less video placeholder. Cached stills render immediately.
export function stillPlaceholderMarkup({ id, ref, owner, still, error, esc, className = "", saveData = false }) {
  if (still) return `<img class="${className}" src="${esc(still)}" alt="" decoding="async" />`;
  const state = error ? "is-error" : saveData ? "is-saver" : "is-waiting";
  const label = error ? "Retry preview" : saveData ? "Load preview" : "";
  return `<span class="xe-noposter ${className} ${state}" data-xe-still="${esc(id)}" data-xe-still-ref="${esc(ref)}" data-xe-still-owner="${esc(owner || "")}" ${saveData && !error ? 'data-xe-still-manual="true"' : ""}>${label
    ? `<span class="xe-still-action" role="button" tabindex="0" data-xe-still-retry="${esc(id)}">${label}</span>` : ""}</span>`;
}

// Viewport-lazy binding: only on-screen placeholders are queued; off-screen ones are cancelled.
export function bindStillPlaceholders(root, queue, { saveData = false, esc } = {}) {
  const nodes = [...root.querySelectorAll("[data-xe-still]")];
  const paint = (id, still, error) => {
    root.querySelectorAll(`[data-xe-still="${CSS.escape(id)}"]`).forEach(node => {
      const className = [...node.classList].filter(c => !["xe-noposter", "is-error", "is-waiting", "is-saver"].includes(c)).join(" ");
      node.outerHTML = stillPlaceholderMarkup({ id, ref: node.dataset.xeStillRef, owner: node.dataset.xeStillOwner, still, error, esc, className, saveData });
    });
    bindRetry();
  };
  const unsubscribe = queue.subscribe(paint);
  const bindRetry = () => root.querySelectorAll("[data-xe-still-retry]").forEach(button => {
    const run = event => {
      event.preventDefault(); event.stopPropagation();
      const node = button.closest("[data-xe-still]");
      if (!node) return;
      node.className = node.className.replace(/is-error|is-saver/g, "is-waiting");
      button.remove();
      queue.request(node.dataset.xeStill, node.dataset.xeStillRef, { retry: true });
    };
    button.onclick = run;
    button.onkeydown = event => { if (event.key === "Enter" || event.key === " ") run(event); };
  });
  bindRetry();
  if (!nodes.length) return unsubscribe;
  const auto = nodes.filter(node => !node.dataset.xeStillManual && !node.classList.contains("is-error"));
  if (typeof IntersectionObserver !== "function") return unsubscribe;
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    const { xeStill: id, xeStillRef: ref } = entry.target.dataset;
    if (entry.isIntersecting) queue.request(id, ref);
    else queue.cancel(id);
  }), { rootMargin: "120px" });
  auto.forEach(node => observer.observe(node));
  return () => { observer.disconnect(); unsubscribe(); };
}
