import { isProfileSurfacePost } from "./post-surfaces.js";

export const SAVED_FILTERS = [
  ["all", "All"], ["collections", "Collections"], ["reels", "Videos"], ["posts", "Posts"], ["audio", "Audio"],
];
export const ARCHIVE_TYPES = [["stories", "Stories"], ["posts", "Posts"]];
export const PAGE_SIZE = 18;
const MEDIA_CONCURRENCY = 3;
const COLLECTION_SCAN_PAGES = 6;

export function visibleLibraryPosts(posts) {
  return (Array.isArray(posts) ? posts : []).filter(post => post && post.id && isProfileSurfacePost(post));
}

function fmtDate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  try { return new Date(n).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; }
}

function errMsg(error, fallback) { console.warn("[account-library]", error); return fallback; }

export function renderAccountLibrary(ctx, { view = "saved" } = {}) {
  const esc = ctx.esc || (v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const ic = name => ctx.icons?.[name] || "";
  const lib = ctx.library;
  const host = ctx.shell;
  const mode = view === "archive" ? "archive" : "saved";
  let gen = 0;
  let observer = null;
  let mediaQueue = [];
  let mediaActive = 0;
  const mediaCache = new Map();
  let state;

  function fresh() {
    return {
      tab: mode === "saved" ? "all" : "stories",
      lists: {},          // key -> {items, hasMore, nextOffset, loading, error, loaded}
      sounds: null,       // {items, loading, error}
      collections: null,  // {items, loading, error}
      prefs: null,        // {value, loading, error, saving}
      openCollection: null,
      sheet: null,        // {type:'create'|'rename'|'pick'|'confirm', ...}
    };
  }

  const root = document.createElement("section");
  root.className = `acl acl-${mode}`;
  root.setAttribute("aria-label", mode === "saved" ? "Saved" : "Archive");
  host.replaceChildren(root);

  function listKey() { return mode === "saved" ? `saved:${state.tab === "collections" ? "all" : state.tab}` : `archive:${state.tab}`; }
  function list(key) { return state.lists[key] || (state.lists[key] = { items: [], hasMore: false, nextOffset: 0, loading: false, error: "", loaded: false }); }

  async function loadPage(key, more = false) {
    const l = list(key);
    if (l.loading || (more && !l.hasMore) || (!more && l.loaded)) return;
    const g = gen;
    l.loading = true; l.error = ""; paint();
    try {
      const offset = more ? l.nextOffset : 0;
      const [kind, arg] = key.split(":");
      const res = kind === "saved"
        ? await lib.saved({ filter: arg, offset, limit: PAGE_SIZE })
        : await lib.archive({ type: arg, offset, limit: PAGE_SIZE });
      if (g !== gen) return;
      const raw = arg === "stories" ? (Array.isArray(res?.stories) ? res.stories : null) : (Array.isArray(res?.posts) ? res.posts : null);
      if (!raw) throw new Error("The server returned an unexpected response.");
      const page = arg === "stories" ? raw.filter(s => s && s.id) : visibleLibraryPosts(raw);
      const seen = new Set(more ? l.items.map(i => i.id) : []);
      l.items = [...(more ? l.items : []), ...page.filter(i => !seen.has(i.id))];
      l.hasMore = res.hasMore === true;
      l.nextOffset = Number.isSafeInteger(res.nextOffset) && res.nextOffset > offset ? res.nextOffset : offset + raw.length;
      if (raw.length === 0) l.hasMore = false;
      l.loaded = true;
    } catch (error) {
      if (g !== gen) return;
      l.error = errMsg(error, "This list could not be loaded.");
    } finally {
      if (g === gen) { l.loading = false; paint(); }
    }
  }

  async function loadSounds(force = false) {
    if (state.sounds && (state.sounds.loading || (!force && !state.sounds.error))) return;
    const g = gen;
    state.sounds = { items: state.sounds?.items || [], loading: true, error: "" }; paint();
    try {
      const res = await lib.audio();
      if (g !== gen) return;
      if (!Array.isArray(res?.sounds)) throw new Error("The server returned an unexpected response.");
      state.sounds = { items: res.sounds.filter(s => s && s.id), loading: false, error: "" };
    } catch (error) {
      if (g !== gen) return;
      state.sounds = { items: [], loading: false, error: errMsg(error, "Saved audio could not be loaded.") };
    }
    paint();
  }

  async function loadCollections(force = false) {
    if (state.collections && (state.collections.loading || (!force && !state.collections.error))) return;
    const g = gen;
    state.collections = { items: state.collections?.items || [], loading: true, error: "" }; paint();
    try {
      const res = await lib.collections();
      if (g !== gen) return;
      if (!Array.isArray(res?.collections)) throw new Error("The server returned an unexpected response.");
      state.collections = { items: res.collections, loading: false, error: "" };
    } catch (error) {
      if (g !== gen) return;
      state.collections = { items: [], loading: false, error: errMsg(error, "Collections could not be loaded.") };
    }
    paint();
  }

  async function loadPrefs(force = false) {
    if (state.prefs && (state.prefs.loading || (!force && !state.prefs.error))) return;
    const g = gen;
    state.prefs = { value: state.prefs?.value || null, loading: true, error: "", saving: "" }; paint();
    try {
      const v = await lib.preferences();
      if (g !== gen) return;
      if (typeof v?.autoArchiveStories !== "boolean" || typeof v?.allowPostArchive !== "boolean") throw new Error("Archive settings returned an unexpected response.");
      state.prefs = { value: v, loading: false, error: "", saving: "" };
    } catch (error) {
      if (g !== gen) return;
      state.prefs = { value: null, loading: false, error: errMsg(error, "Archive settings could not be loaded."), saving: "" };
    }
    paint();
  }

  async function togglePref(key) {
    const p = state.prefs;
    if (!p?.value || p.saving) return;
    const g = gen;
    const next = !p.value[key];
    p.saving = key; paint();
    try {
      const v = await lib.updatePreferences({ [key]: next });
      if (g !== gen) return;
      if (typeof v?.[key] !== "boolean") throw new Error("Archive settings returned an unexpected response.");
      state.prefs = { value: v, loading: false, error: "", saving: "" };
      ctx.toast?.(next ? "Archiving is on." : "Archiving is off. Existing memories stay in your archive.");
    } catch (error) {
      if (g !== gen) return;
      p.saving = "";
      ctx.toast?.(errMsg(error, "That setting could not be saved."));
    }
    paint();
  }

  /* ---------- media: resolve only visible tiles, bounded concurrency, owner guards ---------- */
  function queueMedia(el) {
    const id = el.dataset.mid;
    if (mediaCache.has(id)) return applyMedia(el, mediaCache.get(id));
    if (el.dataset.queued) return;
    el.dataset.queued = "1";
    mediaQueue.push(el);
    pump();
  }
  function pump() {
    while (mediaActive < MEDIA_CONCURRENCY && mediaQueue.length) {
      const el = mediaQueue.shift();
      if (!el.isConnected) continue;
      const g = gen;
      const { kind, id } = el.dataset;
      const item = findItem(kind, id);
      if (!item || !ctx.resolveMedia) continue;
      mediaActive++;
      Promise.resolve(ctx.resolveMedia({ kind, item }))
        .then(res => {
          if (typeof res === "string") res = { url: res, kind: "image" };
          if (g !== gen || !res?.url) throw new Error("stale");
          mediaCache.set(el.dataset.mid, res);
          root.querySelectorAll(`[data-mid="${CSS.escape(el.dataset.mid)}"]`).forEach(n => applyMedia(n, res));
        })
        .catch(() => { if (g === gen && el.isConnected) el.classList.add("is-unavailable"); })
        .finally(() => { mediaActive--; if (g === gen) pump(); });
    }
  }
  function applyMedia(el, res) {
    if (el.dataset.applied) return;
    el.dataset.applied = "1";
    const src = res.kind === "video" ? (res.poster || "") : res.url;
    if (!src) {
      // Video without a server poster: show its first frame, muted, never autoplaying.
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "metadata";
      v.setAttribute("aria-hidden", "true"); v.tabIndex = -1;
      v.src = /#t=/.test(res.url) || /^blob:|^data:/.test(res.url) ? res.url : `${res.url}#t=0.1`;
      v.onloadeddata = () => el.classList.add("is-ready");
      v.onerror = () => el.classList.add("is-unavailable");
      el.prepend(v);
      return;
    }
    const img = document.createElement("img");
    img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.src = src;
    img.onload = () => el.classList.add("is-ready");
    el.prepend(img);
  }
  function findItem(kind, id) {
    for (const l of Object.values(state.lists)) { const hit = l.items.find(i => String(i.id) === id); if (hit) return hit; }
    return null;
  }
  function observeMedia() {
    const nodes = root.querySelectorAll("[data-mid]:not([data-applied])");
    if (!nodes.length) return;
    if (typeof IntersectionObserver !== "function") { nodes.forEach(queueMedia); return; }
    observer ||= new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { observer.unobserve(e.target); queueMedia(e.target); }
    }, { rootMargin: "160px 0px" });
    nodes.forEach(n => observer.observe(n));
  }

  /* ---------- markup ---------- */
  const skeleton = (n = 6) => `<div class="acl-grid acl-skel" aria-busy="true" aria-label="Loading">${"<span></span>".repeat(n)}</div>`;
  const errorBox = (msg, act) => `<div class="acl-state" role="alert"><b>Couldn't load this.</b><p>${esc(msg)}</p><button type="button" class="acl-btn" data-act="${act}">${ic("refresh")}Try again</button></div>`;
  const empty = (title, body, iconName = "bookmark") => `<div class="acl-empty"><span class="acl-empty-mark">${ic(iconName)}</span><b>${esc(title)}</b><p>${esc(body)}</p></div>`;

  function postTile(post, extra = "") {
    const isVideo = post.kind === "video" || (post.media || []).some(m => /video/.test(String(m?.type || m?.kind || "")));
    const hasMedia = (post.media || []).length > 0;
    const caption = String(post.caption || "").trim();
    // Never print internal account ids; only a resolved username is shown.
    const author = (typeof ctx.authorLabel === "function" ? ctx.authorLabel(post) : "") || (typeof post.author === "object" ? post.author?.username : "") || "";
    return `<article class="acl-tile${isVideo ? " is-reel" : ""}">
      <button type="button" class="acl-tile-open" data-act="open-post" data-id="${esc(post.id)}" aria-label="Open post${caption ? `: ${esc(caption.slice(0, 60))}` : ""}">
        ${hasMedia ? `<span class="acl-media" data-mid="post:${esc(post.id)}" data-kind="post" data-id="${esc(post.id)}"></span>` : `<span class="acl-text">${esc(caption.slice(0, 140) || "Untitled post")}</span>`}
        ${isVideo ? `<span class="acl-badge">${ic("play")}</span>` : ""}
        <span class="acl-tile-meta">${typeof author === "string" && author ? `@${esc(author)}` : ""}</span>
      </button>${extra}</article>`;
  }

  function soundRow(s) {
    const who = s.author?.displayName || s.author?.username || "";
    return `<li class="acl-sound"><button type="button" data-act="open-audio" data-id="${esc(s.id)}" ${s.available === false ? "disabled" : ""}>
      <span class="acl-sound-disc">${ic("music")}</span>
      <span class="acl-sound-copy"><b>${esc(s.title || "Original audio")}</b><small>${esc(who)}${s.available === false ? " · unavailable" : ""}</small></span>
      <span class="acl-sound-go">${ic("play")}</span></button></li>`;
  }

  function pagedGrid(key, emptyHtml, tileFn = postTile) {
    const l = list(key);
    if (!l.loaded && l.error) return errorBox(l.error, `retry:${key}`);
    if (!l.loaded) return skeleton();
    if (!l.items.length) return emptyHtml;
    return `<div class="acl-grid">${l.items.map(i => tileFn(i)).join("")}</div>${more(key)}`;
  }
  function more(key) {
    const l = list(key);
    if (l.error) return `<div class="acl-inline-err" role="alert">${esc(l.error)} <button type="button" data-act="more:${key}">Retry</button></div>`;
    if (!l.hasMore) return "";
    return `<button type="button" class="acl-more" data-act="more:${key}" ${l.loading ? "disabled" : ""}>${l.loading ? "Loading" : "Load more"}</button>`;
  }

  function savedBody() {
    const tab = state.tab;
    if (tab === "audio") return audioSection(true);
    if (tab === "collections") return state.openCollection ? collectionDetail() : collectionsList();
    const emptyCopy = {
      all: ["Nothing saved yet", "Save a post, video or sound to find it here."],
      reels: ["No saved videos", "Videos you save will appear here."],
      posts: ["No saved posts", "Photos and posts you bookmark will gather here."],
    }[tab];
    const grid = pagedGrid(`saved:${tab}`, tab === "all" ? "" : empty(...emptyCopy));
    if (tab !== "all") return grid;
    const l = list("saved:all");
    const s = state.sounds;
    const nothing = l.loaded && !l.items.length && s && !s.loading && !s.error && !s.items.length;
    if (nothing) return empty(...emptyCopy);
    return `${l.loaded && !l.items.length ? "" : `<h3 class="acl-sub">Posts and videos</h3>${grid}`}${audioSection(false)}`;
  }

  function audioSection(full) {
    const s = state.sounds;
    if (!s || s.loading) return `${full ? "" : `<h3 class="acl-sub">Audio</h3>`}<div class="acl-rows-skel" aria-busy="true"><span></span><span></span><span></span></div>`;
    if (s.error) return errorBox(s.error, "retry:audio");
    if (!s.items.length) return full ? empty("No saved audio", "Save a sound from any reel to reuse it later.", "music") : "";
    return `${full ? "" : `<h3 class="acl-sub">Audio</h3>`}<ul class="acl-sounds">${s.items.map(soundRow).join("")}</ul>`;
  }

  function collectionsList() {
    const c = state.collections;
    const head = `<div class="acl-bar"><p>Keep your saved posts in private collections.</p><button type="button" class="acl-btn acl-btn-primary" data-act="new-col">${ic("plus")}New collection</button></div>`;
    if (!c || c.loading) return head + `<div class="acl-rows-skel" aria-busy="true"><span></span><span></span></div>`;
    if (c.error) return head + errorBox(c.error, "retry:collections");
    if (!c.items.length) return head + empty("No collections yet", "Keep your saved posts together.", "grid");
    return head + `<ul class="acl-cols">${c.items.map(col => {
      const n = Array.isArray(col.postIds) ? col.postIds.length : 0;
      return `<li class="acl-col"><button type="button" class="acl-col-open" data-act="open-col" data-id="${esc(col.id)}">
        <span class="acl-col-spine"></span><span class="acl-col-copy"><b>${esc(col.title || "Untitled")}</b><small>${n} ${n === 1 ? "item" : "items"}${col.createdAt ? ` · ${esc(fmtDate(col.createdAt))}` : ""}</small></span>${ic("down")}</button></li>`;
    }).join("")}</ul>`;
  }

  function currentCollection() { return state.collections?.items.find(c => String(c.id) === String(state.openCollection)) || null; }

  function collectionDetail() {
    const col = currentCollection();
    if (!col) { state.openCollection = null; return collectionsList(); }
    const ids = new Set((col.postIds || []).map(String));
    const l = list("saved:all");
    const found = l.items.filter(p => ids.has(String(p.id)));
    const missing = ids.size - found.length;
    const scanning = l.loading || (l.hasMore && missing > 0);
    return `<div class="acl-col-head">
      <button type="button" class="acl-link" data-act="close-col">${ic("back")}Collections</button>
      <h3>${esc(col.title || "Untitled")}</h3>
      <div class="acl-col-actions">
        <button type="button" class="acl-btn acl-btn-primary" data-act="pick">${ic("plus")}Add saved</button>
        <button type="button" class="acl-btn" data-act="rename">${ic("edit")}Rename</button>
        <button type="button" class="acl-btn acl-btn-danger" data-act="del-col">${ic("trash")}Delete</button>
      </div></div>
      ${!l.loaded && l.error ? errorBox(l.error, "retry:saved:all") : !l.loaded ? skeleton(3)
        : !ids.size ? empty("This collection is empty", "Add posts and videos you have saved.", "grid")
        : `<div class="acl-grid">${found.map(p => postTile(p, `<button type="button" class="acl-tile-x" data-act="col-remove" data-id="${esc(p.id)}" aria-label="Remove from collection">${ic("close")}</button>`)).join("")}</div>
          ${scanning ? `<button type="button" class="acl-more" data-act="more:saved:all" ${l.loading ? "disabled" : ""}>${l.loading ? "Loading" : "Load remaining items"}</button>` : ""}
          ${!scanning && missing > 0 ? `<p class="acl-note">${missing} ${missing === 1 ? "item is" : "items are"} no longer available or no longer saved.</p>` : ""}`}`;
  }

  function prefsPanel() {
    const p = state.prefs;
    if (!p || p.loading) return `<div class="acl-prefs is-loading" aria-busy="true"><span></span><span></span></div>`;
    if (p.error) return `<div class="acl-prefs">${errorBox(p.error, "retry:prefs")}</div>`;
    const row = (key, title, desc) => `<label class="acl-pref"><span><b>${title}</b><small>${desc}</small></span>
      <input type="checkbox" role="switch" data-pref="${key}" ${p.value[key] ? "checked" : ""} ${p.saving ? "disabled" : ""}><i aria-hidden="true"></i></label>`;
    return `<div class="acl-prefs">
      ${row("autoArchiveStories", "Keep expired stories", "Stories move here after 24 hours instead of disappearing.")}
      ${row("allowPostArchive", "Archive posts", "Show Archive on your posts so you can hide them without deleting.")}
      <p class="acl-note">Turning either off only affects what happens next. Memories already here stay.</p></div>`;
  }

  function storyTile(s) {
    const text = String(s.text || "").trim();
    return `<article class="acl-tile acl-story">
      <div class="acl-story-face">${s.hasMedia ? `<span class="acl-media" data-mid="story:${esc(s.id)}" data-kind="story" data-id="${esc(s.id)}"></span>` : `<span class="acl-text">${esc(text.slice(0, 120) || "Story")}</span>`}
        <time class="acl-date">${esc(fmtDate(s.createdAt))}</time></div>
      <button type="button" class="acl-tile-act" data-act="share-story" data-id="${esc(s.id)}">${ic("share")}Share memory</button></article>`;
  }
  function archivedPostTile(p) {
    return postTile(p, `<div class="acl-tile-row"><button type="button" class="acl-tile-act" data-act="share-post" data-id="${esc(p.id)}">${ic("share")}Share</button><button type="button" class="acl-tile-act" data-act="restore" data-id="${esc(p.id)}">${ic("refresh")}Restore</button></div>`);
  }

  function archiveBody() {
    const key = `archive:${state.tab}`;
    return state.tab === "stories"
      ? pagedGrid(key, empty("No archived stories", "When keeping expired stories is on, each one lands here after it leaves your profile.", "timeCircle"), storyTile)
      : pagedGrid(key, empty("No archived posts", "Posts you archive are hidden from your profile and kept here for you.", "archive"), archivedPostTile);
  }

  function sheetHtml() {
    const sh = state.sheet;
    if (!sh) return "";
    if (sh.type === "create" || sh.type === "rename") {
      return `<form class="acl-sheet" data-form="${sh.type}"><label for="acl-col-title">${sh.type === "create" ? "New collection" : "Rename collection"}</label>
        <input id="acl-col-title" name="title" maxlength="60" autocomplete="off" required value="${esc(sh.title || "")}">
        <p class="acl-sheet-err" role="alert"></p>
        <div class="acl-sheet-row"><button type="button" class="acl-btn" data-act="sheet-cancel">Cancel</button><button type="submit" class="acl-btn acl-btn-primary">${sh.type === "create" ? "Create" : "Save"}</button></div></form>`;
    }
    if (sh.type === "confirm") {
      return `<div class="acl-sheet" role="alertdialog" aria-label="Delete collection"><b>Delete this collection?</b><p>Your saved posts and videos stay saved. Only the grouping is removed.</p>
        <p class="acl-sheet-err" role="alert"></p>
        <div class="acl-sheet-row"><button type="button" class="acl-btn" data-act="sheet-cancel">Keep</button><button type="button" class="acl-btn acl-btn-danger" data-act="confirm-del">Delete</button></div></div>`;
    }
    if (sh.type === "pick") {
      const col = currentCollection();
      const inCol = new Set((col?.postIds || []).map(String));
      const l = list("saved:all");
      const options = l.items.filter(p => !inCol.has(String(p.id)));
      return `<div class="acl-sheet acl-pick" role="dialog" aria-label="Add saved items"><b>Add saved items</b>
        ${!l.loaded ? (l.error ? errorBox(l.error, "retry:saved:all") : skeleton(3)) : !options.length && !l.hasMore ? `<p>Everything you've saved is already here.</p>` :
          `<div class="acl-pick-grid">${options.map(p => `<label class="acl-pick-item"><input type="checkbox" value="${esc(p.id)}" ${sh.chosen?.has(String(p.id)) ? "checked" : ""}><span>${esc(String(p.caption || "").slice(0, 70) || (p.kind === "video" ? "Video" : "Post"))}</span></label>`).join("")}</div>${more("saved:all")}`}
        <p class="acl-sheet-err" role="alert"></p>
        <div class="acl-sheet-row"><button type="button" class="acl-btn" data-act="sheet-cancel">Cancel</button><button type="button" class="acl-btn acl-btn-primary" data-act="pick-save">Add</button></div></div>`;
    }
    return "";
  }

  function tabs() {
    const set = mode === "saved" ? SAVED_FILTERS : ARCHIVE_TYPES;
    return `<div class="acl-tabs" role="tablist">${set.map(([id, label]) => `<button type="button" role="tab" aria-selected="${state.tab === id}" class="${state.tab === id ? "on" : ""}" data-tab="${id}">${label}</button>`).join("")}</div>`;
  }

  function ensureData() {
    if (mode === "archive") { loadPrefs(); loadPage(`archive:${state.tab}`); return; }
    if (state.tab === "audio") return loadSounds();
    if (state.tab === "collections") { loadCollections(); if (state.openCollection) loadPage("saved:all"); return; }
    loadPage(listKey());
    if (state.tab === "all") loadSounds();
  }

  let painting = false;
  function paint() {
    if (painting || !root.isConnected) return;
    painting = true;
    const active = document.activeElement;
    const keepSheet = state.sheet && (state.sheet.type === "create" || state.sheet.type === "rename") && root.querySelector(".acl-sheet");
    const scroller = root.closest(".page") || document.scrollingElement;
    const top = scroller?.scrollTop;
    if (!root.firstChild) {
      root.innerHTML = `<header class="acl-head"><button type="button" class="acl-back" data-act="back" aria-label="Back">${ic("back")}</button>
        <div><h1>${mode === "saved" ? "Saved" : "Archive"}</h1><p>${mode === "saved" ? "Private to you" : "Only you can see these memories"}</p></div></header>
        <div class="acl-tabs-slot"></div><div class="acl-prefs-slot"></div><div class="acl-body"></div><div class="acl-sheet-slot"></div>`;
    }
    root.querySelector(".acl-tabs-slot").innerHTML = tabs();
    root.querySelector(".acl-prefs-slot").innerHTML = mode === "archive" ? prefsPanel() : "";
    root.querySelector(".acl-body").innerHTML = mode === "saved" ? savedBody() : archiveBody();
    if (!keepSheet) root.querySelector(".acl-sheet-slot").innerHTML = sheetHtml();
    root.classList.toggle("has-sheet", Boolean(state.sheet));
    for (const [mid, res] of mediaCache) root.querySelectorAll(`[data-mid="${CSS.escape(mid)}"]`).forEach(n => applyMedia(n, res));
    observeMedia();
    if (scroller && typeof top === "number") scroller.scrollTop = top;
    if (active && active !== document.body && !root.contains(active) === false && active.isConnected) active.focus?.({ preventScroll: true });
    painting = false;
  }

  function sheetError(msg) { const n = root.querySelector(".acl-sheet-err"); if (n) n.textContent = msg; }
  function setSheetBusy(b) { root.querySelectorAll(".acl-sheet button, .acl-sheet input").forEach(n => { if (n.type !== "text" && n.name !== "title") n.disabled = b; }); }

  async function saveCollection(payload, okMsg) {
    const g = gen;
    setSheetBusy(true);
    try {
      const res = await lib.saveCollection(payload);
      if (g !== gen) return false;
      const col = res?.collection;
      if (!col?.id) throw new Error("The server returned an unexpected response.");
      const items = state.collections?.items || [];
      const idx = items.findIndex(c => String(c.id) === String(col.id));
      state.collections = { items: idx >= 0 ? items.map((c, i) => i === idx ? col : c) : [col, ...items], loading: false, error: "" };
      ctx.toast?.(okMsg);
      return col;
    } catch (error) {
      if (g === gen) { setSheetBusy(false); sheetError(errMsg(error, "That change could not be saved.")); }
      return false;
    }
  }

  async function onClick(event) {
    const tabBtn = event.target.closest("[data-tab]");
    if (tabBtn && root.contains(tabBtn)) {
      state.tab = tabBtn.dataset.tab; state.openCollection = null; state.sheet = null;
      paint(); ensureData(); return;
    }
    const btn = event.target.closest("[data-act]");
    if (!btn || !root.contains(btn) || btn.disabled) return;
    const act = btn.dataset.act; const id = btn.dataset.id;
    if (act === "back") return ctx.onBack?.();
    if (act.startsWith("retry:")) {
      const what = act.slice(6);
      if (what === "audio") return loadSounds(true);
      if (what === "collections") return loadCollections(true);
      if (what === "prefs") return loadPrefs(true);
      const l = list(what); l.error = ""; l.loaded = false; return loadPage(what);
    }
    if (act.startsWith("more:")) { const key = act.slice(5); list(key).error = ""; return loadPage(key, true); }
    if (act === "open-post") return ctx.onOpenPost?.(id);
    if (act === "open-audio") { const s = state.sounds?.items.find(x => String(x.id) === id); if (s) ctx.onOpenAudio?.(s); return; }
    if (act === "share-story") { const item = list("archive:stories").items.find(x => String(x.id) === id); if (item) ctx.onReshareMemory?.({ kind: "story", item }); return; }
    if (act === "share-post") { const item = list("archive:posts").items.find(x => String(x.id) === id); if (item) ctx.onReshareMemory?.({ kind: "post", item }); return; }
    if (act === "restore") {
      const l = list("archive:posts"); const item = l.items.find(x => String(x.id) === id);
      if (!item) return;
      const g = gen; btn.disabled = true;
      try {
        await ctx.onRestorePost?.(item);
        if (g !== gen) return;
        l.items = l.items.filter(x => x.id !== item.id);
        l.nextOffset = Math.max(0, l.nextOffset - 1);
        paint();
      } catch (error) { if (g === gen) { btn.disabled = false; ctx.toast?.(errMsg(error, "The post could not be restored.")); } }
      return;
    }
    if (act === "new-col") { state.sheet = { type: "create", title: "" }; paint(); root.querySelector("#acl-col-title")?.focus(); return; }
    if (act === "open-col") { state.openCollection = id; paint(); loadPage("saved:all"); return; }
    if (act === "close-col") { state.openCollection = null; state.sheet = null; paint(); return; }
    if (act === "rename") { state.sheet = { type: "rename", title: currentCollection()?.title || "" }; paint(); root.querySelector("#acl-col-title")?.select(); return; }
    if (act === "del-col") { state.sheet = { type: "confirm" }; paint(); return; }
    if (act === "pick") { state.sheet = { type: "pick", chosen: new Set() }; paint(); loadPage("saved:all"); return; }
    if (act === "sheet-cancel") { state.sheet = null; paint(); return; }
    if (act === "confirm-del") {
      const col = currentCollection(); if (!col) return;
      const g = gen; setSheetBusy(true);
      try {
        await lib.deleteCollection(col.id);
        if (g !== gen) return;
        state.collections.items = state.collections.items.filter(c => c.id !== col.id);
        state.openCollection = null; state.sheet = null; paint();
        ctx.toast?.("Collection deleted. Your saves are untouched.");
      } catch (error) { if (g === gen) { setSheetBusy(false); sheetError(errMsg(error, "The collection could not be deleted.")); } }
      return;
    }
    if (act === "pick-save") {
      const col = currentCollection(); const chosen = state.sheet?.chosen;
      if (!col || !chosen?.size) return sheetError("Choose at least one saved item.");
      const ok = await saveCollection({ id: col.id, title: col.title, postIds: [...new Set([...(col.postIds || []).map(String), ...chosen])] }, "Added to collection.");
      if (ok) { state.sheet = null; paint(); }
      return;
    }
    if (act === "col-remove") {
      const col = currentCollection(); if (!col) return;
      btn.disabled = true;
      const ok = await saveCollection({ id: col.id, title: col.title, postIds: (col.postIds || []).map(String).filter(x => x !== String(id)) }, "Removed from collection. It's still saved.");
      if (ok) paint(); else btn.disabled = false;
    }
  }

  function onChange(event) {
    const t = event.target;
    if (t.dataset?.pref) { t.checked = !t.checked; return togglePref(t.dataset.pref); }
    if (state.sheet?.type === "pick" && t.closest(".acl-pick")) { t.checked ? state.sheet.chosen.add(t.value) : state.sheet.chosen.delete(t.value); }
  }

  async function onSubmit(event) {
    const form = event.target.closest("[data-form]");
    if (!form) return;
    event.preventDefault();
    const title = String(form.title.value || "").trim();
    if (!title) return sheetError("Give the collection a name.");
    if (form.dataset.form === "create") {
      const col = await saveCollection({ title, postIds: [] }, "Collection created.");
      if (col) { state.sheet = null; state.openCollection = col.id; paint(); loadPage("saved:all"); }
    } else {
      const cur = currentCollection(); if (!cur) return;
      const col = await saveCollection({ id: cur.id, title, postIds: cur.postIds || [] }, "Collection renamed.");
      if (col) { state.sheet = null; paint(); }
    }
  }

  function onKey(event) { if (event.key === "Escape" && state.sheet) { event.stopPropagation(); state.sheet = null; paint(); } }

  root.addEventListener("click", onClick);
  root.addEventListener("change", onChange);
  root.addEventListener("submit", onSubmit);
  root.addEventListener("keydown", onKey);

  function teardownMedia() { gen++; observer?.disconnect(); observer = null; mediaQueue = []; mediaActive = 0; }

  function reset() {
    teardownMedia();
    mediaCache.clear();
    state = fresh();
    root.replaceChildren();
    paint();
    ensureData();
  }
  reset();

  return {
    reset,
    cleanup() {
      teardownMedia(); mediaCache.clear();
      root.removeEventListener("click", onClick); root.removeEventListener("change", onChange);
      root.removeEventListener("submit", onSubmit); root.removeEventListener("keydown", onKey);
      root.remove();
    },
    /* test/inspection hook */
    get state() { return state; },
    scanLimit: COLLECTION_SCAN_PAGES,
  };
}
