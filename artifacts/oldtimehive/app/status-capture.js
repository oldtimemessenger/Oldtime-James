// Simple Snapchat-style Status capture: camera / gallery / text -> light
// decorations (text, emoji, draw) -> one explicit "Send to Status".
// Heavy modules are imported lazily so this file stays cheap to load and testable.
import { tipIllustration } from "./tip-illustrations.js";
import { bindMentionAutocomplete } from "./mention-autocomplete.js";
import { PICKER_KINDS, STICKER_LABELS, TITLE_MAX, PROMPT_MAX, ANSWER_MAX, ANSWER_PROMPT_MAX, DEFAULT_PROMPTS, normalizeStickers, canAddSticker, addSticker, removeSticker,
  updateStickerText, resizeSticker, moveSticker, hitSticker, pinchDelta, clampMediaTransform, publishStickers, clampSticker, isUuid } from "./status-sticker-editor.js";
import { MAX_TEXT_LABELS, canAddLabel, emptyDraft, placementPoint, hitTextLabel, joinLabelText } from "./status-text-labels.js";
import { OVERLAY_ACCEPT, isOverlayFile, overlaySlots, overlaySize, overlayPosition, hitOverlay, scaleOverlay, moveOverlay, overlayInsertIndex, MAX_OVERLAYS } from "./status-overlay.js";
import { drawStatusStickers, loadStickerArt, STICKER_ART } from "./status-sticker-art.js";
const stickerArtSrc = kind => STICKER_ART[kind] || "";
const galleryGlyph = new URL("./assets/gallery-glyph.png", import.meta.url).href;

export const STATUS_COLORS = ["#ffffff", "#17191c", "#1456d9", "#e0245e", "#8e1b24", "#8dba91", "#f2c94c", "#f2f4f7", "#6b6f76"];
export const STATUS_FONTS = ["Manrope", "Georgia", "system-ui", "monospace"];
export const FONT_LABELS = { Manrope: "Classic", Georgia: "Serif", "system-ui": "Simple", monospace: "Type" };
export const HOLD_MS = 280;
export const MAX_RECORD_MS = 30_000;

export function statusAudiences(isPrivate) {
  return [
    { value: "public", label: "Everyone", allowed: !isPrivate },
    { value: "close-friends", label: "Close friends", allowed: true },
  ];
}
export function defaultAudience(isPrivate, requested) {
  if (requested === "close-friends") return "close-friends";
  if (requested === "public" && !isPrivate) return "public";
  return isPrivate ? "close-friends" : "public";
}
export function recorderMime(isSupported = t => globalThis.MediaRecorder?.isTypeSupported?.(t)) {
  for (const type of ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]) {
    try { if (isSupported(type)) return type; } catch {}
  }
  return "";
}
export function friendlyError(error, fallback = "Something went wrong. Your Status is still here; try again.") {
  console.error("[status-capture]", error);
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera access is off. You can still choose from your gallery or write a text Status.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found. You can still choose from your gallery or write a text Status.";
  if (name === "NotReadableError") return "The camera is busy in another app. Close it and try again, or use the gallery.";
  return fallback;
}
export function mediaKind(file) {
  const type = String(file?.type || "");
  return type.startsWith("video/") ? "video" : type.startsWith("image/") ? "image" : "";
}

const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ICON = {
  overlay: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="12" height="12" rx="2"/><path d="M8 4h11a2 2 0 0 1 2 2v9M3 16l4-4 4 4"/></svg>',
  sticker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10l4 4v7a5 5 0 0 1-5 5H5z"/><path d="M15 4v4h4M8.5 13.5c1.6 1.6 4.4 1.6 6 0"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  bigger: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>',
  smaller: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  flip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2M20 4v4h-4M4 20v-4h4"/></svg>',
  emoji: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/></svg>',
  draw: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3"/></svg>',
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 0 1 0 6"/></svg>',
  muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10H4zM17 10l4 4M21 10l-4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>',
};

export const STATUS_TEXT_STYLES = ["classic", "plain", "box"];
export const STYLE_LABELS = { classic: "Classic", plain: "Plain", box: "Box" };
export function statusTextStyle(style, color = "#ffffff", boxColor = "#17191c") {
  const s = STATUS_TEXT_STYLES.includes(style) ? style : "classic";
  const base = { statusStyle: s, x: .5, y: .5, scale: 1, rotation: 0, align: "center", startTime: 0, endTime: 3600,
    textEffect: { name: "plain", amount: .6 }, caseStyle: undefined, letterSpacing: 0, italic: false, outline: false, color };
  if (s === "plain") return { ...base, font: "system-ui", bold: false, shadow: false, backgroundOn: false };
  if (s === "box") return { ...base, font: "Manrope", bold: true, shadow: false, backgroundOn: true, bubble: "rounded", backgroundOpacity: 1,
    background: boxColor || "#17191c", ...(color === boxColor ? { color: boxColor === "#ffffff" ? "#17191c" : "#ffffff" } : {}) };
  return { ...base, font: "Manrope", bold: true, shadow: true, backgroundOn: false };
}
// Largest font size whose wrapped text fits the frame; always centered.
export function fitTextLayout(ctx, { textStyle, wrapLines }, layer, textOnly) {
  const maxWidth = 920, padding = 30, maxHeight = textOnly ? 1500 : 1000;
  let size = textOnly ? 132 : 96, lines = [];
  for (; size >= 26; size -= 4) {
    const probe = { ...layer, fontSize: size }, st = textStyle(probe);
    ctx.font = st.font; try { ctx.letterSpacing = "0px"; } catch {}
    lines = wrapLines(ctx, st.text || " ", maxWidth - padding * 2);
    if (lines.length * st.lineHeight + padding * 2 <= maxHeight) break;
  }
  size = Math.max(26, size);
  const st = textStyle({ ...layer, fontSize: size }); ctx.font = st.font;
  const widest = Math.max(0, ...lines.map(line => ctx.measureText(line).width));
  const width = layer.backgroundOn ? Math.min(maxWidth, Math.max(160, Math.ceil(widest + padding * 2 + 8))) : maxWidth;
  return { fontSize: size, width, x: .5, y: .5, scale: 1, rotation: 0, align: "center" };
}
export function normalizeSeedKind(kind, media = "") {
  const k = String(kind || "").toLowerCase();
  if (k === "video") return "video";
  if (k === "photo" || k === "image") return "image";
  return /\.(mp4|webm|mov)(\?|$)/i.test(String(media)) ? "video" : "image";
}
// One project, single background: pages/timeline-only data is dropped.
export function seedProject(base, { background = null, initialProject = null } = {}) {
  const project = base;
  if (initialProject) {
    const copy = structuredClone(initialProject);
    delete copy.pages; delete copy.activePage;
    Object.assign(project, copy);
    project.layers = (project.layers || []).map(l => ({ ...l, startTime: 0, endTime: Math.max(3600, Number(l.endTime) || 0) }));
    project.audioTracks ||= [];
  }
  if (background?.media) {
    const kind = normalizeSeedKind(background.kind, background.media);
    project.background = { ...(initialProject ? project.background : {}), kind, media: String(background.media), color: project.background?.color || "#17191c" };
  } else if (project.background?.media) {
    project.background.kind = normalizeSeedKind(project.background.kind, project.background.media);
  }
  return project;
}

export function openStatusCapture({ source = "landing", toast = () => {}, onPosted = () => {}, onClose = () => {}, visibility, background = null, initialProject = null, shareText = "", validateSource, initialStickers = [], answerQuestionId = null } = {}) {
  // Sticker seeds survive camera / gallery / text choices: they live outside the per-media project.
  const seedQuestionId = isUuid(answerQuestionId) ? answerQuestionId : null;
  const stickers = normalizeStickers(initialStickers, { answerQuestionId: seedQuestionId });
  // Separate multi-select input for collage pictures (never the background gallery input).
  const overlayInput = document.createElement("input");
  overlayInput.type = "file"; overlayInput.accept = OVERLAY_ACCEPT; overlayInput.multiple = true; overlayInput.hidden = true;
  overlayInput.dataset.testid = "input-status-overlay";
  let selectedOverlayId = null;
  let mentionCleanup = () => {};
  let selectedStickerId = null, stickerFormId = null, stickerPickerOpen = false;
  const seeded = !!(background?.media || initialProject);
  if (seeded) source = "seed";
  // Gallery must be opened synchronously to keep the user activation.
  const fileInput = document.createElement("input");
  fileInput.type = "file"; fileInput.accept = "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"; fileInput.hidden = true;
  if (source === "gallery") { document.body.append(fileInput); try { fileInput.click(); } catch {} }

  const root = document.createElement("div");
  root.className = "sc-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "New Status");
  root.append(fileInput, overlayInput);
  document.body.append(root);
  const prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";

  const owned = new Set(); // blob URLs we created
  const cleanups = [];
  let closed = false, stream = null, facing = "user", recorder = null, recordTimer = null, holdTimer = null, recordStart = 0;
  let recordToken = 0, recordPending = false, cameraFrameRate = null, cameraRequest = 0;
  let busy = false, sent = false, isPrivate = false, audience = defaultAudience(false, visibility), privacyKnown = false;
  let mods = null; // lazily loaded renderer modules
  let project = null, assets = null, video = null, sourceBlob = null, dirty = false, raf = 0;
  let drawMode = false, drawColor = "#ffffff", editingId = null, statusTextId = null, editorKind = "", measureCtx = null, openSeq = 0;
  let api = null, M = null;

  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };
  const own = blob => { const url = URL.createObjectURL(blob); owned.add(url); return url; };
  const loadMods = () => mods ||= Promise.all([import("./creative-project.js"), import("./creative-renderer.js"), import("./creative-export.js")])
    .then(([p, r, e]) => ({ ...p, ...r, ...e }));
  const loadApi = () => api ? Promise.resolve(api) : import("./store.js").then(m => (api = m.api));

  loadApi().then(a => a.syncCloudPrivacy()).then(priv => {
    isPrivate = !!priv; privacyKnown = true; audience = defaultAudience(isPrivate, visibility); renderAudience();
  }).catch(error => { console.error("[status-capture] privacy", error); privacyKnown = true; renderAudience(); });

  function stopStream() { for (const track of stream?.getTracks() || []) track.stop(); stream = null; }
  function cleanupAll() {
    closed = true; cancelAnimationFrame(raf); clearTimeout(holdTimer); clearTimeout(recordTimer);
    try { if (recorder?.state !== "inactive") recorder?.stop(); } catch {}
    stopStream(); for (const fn of cleanups.splice(0)) fn();
    try { assets?.dispose(); } catch {}
    for (const url of owned) URL.revokeObjectURL(url); owned.clear();
    import("./emoji.js").then(m => m.closeEmojiPicker?.()).catch(() => {});
    mentionCleanup();
    document.body.style.overflow = prevOverflow; root.remove(); fileInput.remove(); overlayInput.remove();
  }
  function close(force = false) {
    if (closed) return;
    if (busy && !force) return;
    if (!force && !sent && project && dirty && !window.confirm("Discard this Status? It hasn't been sent.")) return;
    cleanupAll(); onClose?.({ posted: sent });
  }
  listen(document, "keydown", event => {
    if (event.key !== "Escape") return;
    if (editingId) { event.preventDefault(); finishText(); return; }
    event.preventDefault(); close();
  });

  // ---------------- Capture stage ----------------
  function showLanding() {
    openSeq++; recordToken++; recordPending = false;
    clearTimeout(holdTimer); clearTimeout(recordTimer);
    try { if (recorder?.state !== "inactive") recorder?.stop(); } catch {}
    stopStream(); cancelAnimationFrame(raf);
    root.classList.remove("sc-typing"); editingId = null; project = null; source = "landing";
    root.innerHTML = ""; root.append(fileInput, overlayInput);
    root.insertAdjacentHTML("beforeend", `
      <section class="sc-stage sc-choice" data-testid="status-choice">
        <header class="sc-choice-header">
          <button type="button" class="sc-choice-close" data-act="close" aria-label="Close" data-testid="button-close-status">${ICON.close}</button>
          <h1>New Status</h1>
        </header>
        <div class="sc-choice-intro"><h2>Share a moment</h2><p>Choose how to create your Status.</p></div>
        <div class="sc-choice-options">
          ${[
            ["camera", "Camera", "Take a photo or record a video", tipIllustration("studio")],
            ["gallery", "Photo or video", "Choose from your library", `<img src="${esc(galleryGlyph)}" alt="" draggable="false">`],
            ["text", "Text", "Write a text Status", tipIllustration("note")],
          ].map(([act, title, detail, art]) => `<button type="button" class="sc-choice-option" data-act="${act}" data-testid="status-choice-${act}">
            <span class="sc-choice-art" aria-hidden="true">${art}</span><span class="sc-choice-copy"><b>${title}</b><small>${detail}</small></span>
            <span class="sc-choice-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></span></button>`).join("")}
        </div>
      </section>`);
  }
  function showCapture(message = "") {
    openSeq++; root.classList.remove("sc-typing"); editingId = null;
    project = null; cancelAnimationFrame(raf);
    root.innerHTML = "";
    root.append(fileInput, overlayInput);
    root.insertAdjacentHTML("beforeend", `
      <section class="sc-stage sc-capture" data-testid="status-capture">
        <video class="sc-live" playsinline muted autoplay data-testid="video-camera"></video>
        <div class="sc-cam-note" data-testid="text-camera-message" ${message || source !== "camera" ? "" : "hidden"}>
          <p>${esc(message || (source === "gallery" ? "Choose a photo or video for your Status." : ""))}</p>
          <button type="button" class="sc-pill" data-act="gallery" data-testid="button-choose-media">Choose photo or video</button>
          <button type="button" class="sc-pill sc-pill-ghost" data-act="text" data-testid="button-text-status">Write a text Status</button>
          ${source === "camera" || message ? `<button type="button" class="sc-pill sc-pill-ghost" data-act="retry-camera" data-testid="button-retry-camera">Try camera again</button>` : ""}
        </div>
        <header class="sc-top">
          <button type="button" class="sc-icon" data-act="landing" aria-label="Back to Status choices" data-testid="button-back-to-status-choices">${ICON.back}</button>
          <span class="sc-rec" hidden data-testid="status-recording">0:00</span>
          <button type="button" class="sc-icon" data-act="flip" aria-label="Switch camera" data-testid="button-flip-camera">${ICON.flip}</button>
        </header>
        <footer class="sc-shutter-row">
          <button type="button" class="sc-thumb" data-act="gallery" aria-label="Choose from gallery" data-testid="button-gallery"><span></span></button>
          <button type="button" class="sc-shutter" aria-label="Tap for photo, hold for video" data-testid="button-shutter"><i></i></button>
          <button type="button" class="sc-aa" data-act="text" aria-label="Text Status" data-testid="button-aa">Aa</button>
        </footer>
        <p class="sc-hint">Tap for photo, hold for video</p>
      </section>`);
    const shutter = root.querySelector(".sc-shutter");
    shutter.addEventListener("pointerdown", shutterDown);
    shutter.addEventListener("pointerup", shutterUp);
    shutter.addEventListener("pointercancel", shutterUp);
    shutter.addEventListener("pointerleave", e => { if (recorder || recordPending || holdTimer) shutterUp(e); });
    shutter.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); takePhoto(); } });
    shutter.addEventListener("contextmenu", e => e.preventDefault());
  }
  async function startCamera() {
    const request = ++cameraRequest, captureSequence = openSeq;
    const live = root.querySelector(".sc-live"), note = root.querySelector(".sc-cam-note");
    if (!navigator.mediaDevices?.getUserMedia) { showCapture("This browser can't open the camera. You can still choose from your gallery or write a text Status."); return; }
    try {
      stopStream();
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false });
      if (closed || project || request !== cameraRequest || captureSequence !== openSeq) { for (const t of s.getTracks()) t.stop(); return; }
      stream = s; live.srcObject = s;
      const fr = Number(s.getVideoTracks()[0]?.getSettings?.().frameRate);
      cameraFrameRate = Number.isFinite(fr) && fr > 0 ? Math.round(fr * 100) / 100 : null; live.classList.toggle("sc-mirror", facing === "user");
      await live.play().catch(() => {});
      if (note) note.hidden = true;
    } catch (error) { if (!closed && captureSequence === openSeq && request === cameraRequest) showCapture(friendlyError(error)); }
  }
  async function ensureAudio() {
    if (!stream || stream.getAudioTracks().length) return;
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!stream) { for (const t of mic.getTracks()) t.stop(); return; }
      for (const t of mic.getAudioTracks()) stream.addTrack(t);
    } catch (error) { console.error("[status-capture] microphone", error); toast("Recording without sound — microphone access is off."); }
  }
  function shutterDown(event) {
    if (!stream || busy || recorder) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const token = ++recordToken;
    holdTimer = setTimeout(() => { holdTimer = null; startRecording(token); }, HOLD_MS);
  }
  function shutterUp(event) {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; recordToken++; if (event?.type === "pointerup") takePhoto(); return; }
    // Released while the mic prompt was still pending: cancel, never start late.
    if (recordPending) { recordToken++; recordPending = false; return; }
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }
  function takePhoto() {
    const live = root.querySelector(".sc-live");
    if (!stream || !live?.videoWidth) return;
    const c = document.createElement("canvas"); c.width = live.videoWidth; c.height = live.videoHeight;
    const ctx = c.getContext("2d");
    if (facing === "user") { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(live, 0, 0);
    c.toBlob(blob => { c.width = 0; if (blob) openEditor("image", blob); else toast("Couldn't take the photo. Try again."); }, "image/png");
  }
  async function startRecording(token) {
    if (!globalThis.MediaRecorder) { toast("Video recording isn't available on this device. Tap for a photo instead."); return; }
    recordPending = true;
    try { await ensureAudio(); } finally { if (token === recordToken) recordPending = false; }
    if (token !== recordToken || !stream || closed || recorder || project) return;
    const shutter = root.querySelector(".sc-shutter"), rec = root.querySelector(".sc-rec");
    const mimeType = recorderMime();
    const chunks = [];
    try { recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined); }
    catch (error) { toast(friendlyError(error, "Video recording couldn't start. Tap for a photo instead.")); return; }
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const r = recorder; recorder = null; clearTimeout(recordTimer); clearInterval(tick);
      shutter?.classList.remove("sc-recording"); if (rec) rec.hidden = true;
      if (closed) return;
      const elapsed = (performance.now() - recordStart) / 1000;
      const blob = new Blob(chunks, { type: (r.mimeType || mimeType || "video/webm").split(";")[0] });
      if (!blob.size || elapsed < .4) { toast("Hold a little longer to record a video."); return; }
      openEditor("video", blob, elapsed, null, cameraFrameRate);
    };
    recordStart = performance.now(); recorder.start(250);
    shutter?.classList.add("sc-recording"); if (rec) rec.hidden = false;
    const tick = setInterval(() => { const s = Math.floor((performance.now() - recordStart) / 1000); if (rec) rec.textContent = `0:${String(s).padStart(2, "0")}`; }, 250);
    recordTimer = setTimeout(() => { if (recorder?.state === "recording") recorder.stop(); }, MAX_RECORD_MS);
  }
  root.addEventListener("click", event => {
    const act = event.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "close") close();
    else if (act === "landing") showLanding();
    else if (act === "camera") { source = "camera"; showCapture(); startCamera(); }
    else if (act === "gallery") { source = "gallery"; fileInput.value = ""; fileInput.click(); }
    else if (act === "text") { source = "text"; stopStream(); openEditor("text"); }
    else if (act === "flip") { facing = facing === "user" ? "environment" : "user"; startCamera(); }
    else if (act === "retry-camera") { showCapture(); startCamera(); }
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0]; if (!file) return;
    const kind = mediaKind(file);
    if (!kind) { toast("Choose a photo or video."); return; }
    if (project && dirty && !window.confirm("Replace your current Status?")) return;
    openEditor(kind, file);
  });

  // ---------------- Editor stage ----------------
  async function openEditor(kind, blob = null, recordedSeconds = 0, seed = null, knownFrameRate = null) {
    stopStream(); cancelAnimationFrame(raf);
    try { assets?.dispose(); } catch {}
    const seq = ++openSeq;
    video = null; sourceBlob = blob; drawMode = false; editingId = null; statusTextId = null; root.classList.remove("sc-typing");
    root.innerHTML = ""; root.append(fileInput, overlayInput);
    root.insertAdjacentHTML("beforeend", `<section class="sc-stage sc-edit"><div class="sc-skel" aria-label="Loading"></div></section>`);
    let m;
    try { m = M = await loadMods(); } catch (error) { showCapture(friendlyError(error, "Couldn't open the editor. Check your connection and try again.")); return; }
    if (closed || seq !== openSeq) return;
    assets = new m.CreativeAssets();
    project = m.createProject();
    dirty = kind !== "text";
    if (seed) {
      seedProject(project, seed); dirty = true;
      kind = project.background?.media ? project.background.kind : "text";
      try {
        const loads = project.layers.filter(l => l.kind === "image" && l.media).map(l => assets.load(l.media));
        let media = null;
        if (project.background?.media) media = await assets.load(project.background.media, kind === "video" ? "video" : "image");
        await Promise.all(loads);
        if (closed || seq !== openSeq) return;
        if (kind === "video" && media) {
          video = media; video.loop = true; video.muted = true;
          const d = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : video.creativeDuration;
          project.duration = Math.max(.5, Math.min(60, d || project.duration || 5));
          // Original bytes let the exporter detect/keep the source audio.
          try { const r = await fetch(video.currentSrc || video.src); if (r.ok) sourceBlob = await r.blob(); } catch (e) { console.error("[status-capture] source blob", e); }
        }
      } catch (error) {
        cleanupAll(); toast(friendlyError(error, "This media can't be opened for Status. Try again."));
        try { onClose?.({ posted: false }); } catch {}
        return;
      }
    } else if (kind === "text") {
      project.background = { kind: "color", color: "#1456d9", media: "" };
    } else {
      const url = own(blob);
      try {
        const media = await assets.load(url, kind === "video" ? "video" : "image");
        if (closed || seq !== openSeq) return;
        project.background = { kind: kind === "video" ? "video" : "image", media: url, color: "#17191c", fit: "cover", statusTransform: { x: 0, y: 0, scale: 1 } };
        if (kind === "video") {
          video = media; video.loop = true; video.muted = true;
          if (knownFrameRate) video.dataset.sourceFrameRate = String(knownFrameRate);
          const d = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : video.creativeDuration || recordedSeconds;
          project.duration = Math.max(.5, Math.min(60, d || 5));
        }
      } catch (error) {
        showCapture(friendlyError(error, kind === "video" ? "This video can't be opened here. Try another one." : "This photo can't be opened here. Try another one."));
        return;
      }
    }
    project.duration ||= 5;
    if (project.background?.media) project.background.statusTransform = clampMediaTransform(project.background.statusTransform);
    project.statusStickers = stickers; // same array: edits persist across retakes
    selectedStickerId = null; stickerFormId = null; stickerPickerOpen = false;
    void loadStickerArt();
    buildEditor(kind);
    if (kind === "text" && !seed) openTextEditor();
  }

  function buildEditor(kind) {
    const isText = kind === "text";
    const sw = (group, c) => `<button type="button" class="sc-sw" style="--c:${c}" data-${group}="${c}" aria-label="${group === "text-color" ? "Text" : "Background"} color ${c}" aria-pressed="false" data-testid="button-${group}-${c.slice(1)}"></button>`;
    root.querySelector(".sc-edit").innerHTML = `
      <div class="sc-canvas-wrap"><canvas class="sc-canvas" width="540" height="960" data-testid="canvas-status"></canvas></div>
      <header class="sc-top sc-edit-top">
        <button type="button" class="sc-icon" data-ed="back" aria-label="${isText || source === "seed" ? "Close" : "Retake"}" data-testid="button-back">${isText || source === "seed" ? ICON.close : ICON.back}</button>
        <div class="sc-tools">
          ${kind === "video" ? `<button type="button" class="sc-icon" data-ed="sound" aria-label="Play sound" data-testid="button-sound">${ICON.muted}</button>` : ""}
          <button type="button" class="sc-icon sc-aa-sm" data-ed="text" aria-label="Edit text" data-testid="button-add-text">Aa</button>
          <button type="button" class="sc-icon" data-ed="emoji" aria-label="Add emoji" data-testid="button-add-emoji">${ICON.emoji}</button>
          ${isText ? "" : `<button type="button" class="sc-icon" data-ed="draw" aria-label="Draw" aria-pressed="false" data-testid="button-draw">${ICON.draw}</button>`}
          <button type="button" class="sc-icon" data-ed="overlay" aria-label="Add picture overlay" data-testid="button-add-overlay">${ICON.overlay}</button>
          <button type="button" class="sc-icon" data-ed="stickers" aria-label="Stickers" aria-expanded="false" data-testid="button-stickers">${ICON.sticker}</button>
          ${isText ? "" : `<button type="button" class="sc-icon sc-fit" data-ed="fit" aria-label="Show the full photo or video" data-testid="button-fit">Fit</button>`}
        </div>
      </header>
      ${isText ? "" : `<div class="sc-drawbar" hidden>
        <button type="button" class="sc-icon" data-ed="undo" aria-label="Undo stroke" data-testid="button-undo-draw">${ICON.undo}</button>
        <div class="sc-swatches">${STATUS_COLORS.map(c => sw("draw-color", c)).join("")}</div>
        <button type="button" class="sc-pill sc-pill-sm" data-ed="draw" data-testid="button-done-draw">Done</button>
      </div>`}
      <div class="sc-texted" hidden>
        <div class="sc-texted-top"><button type="button" class="sc-pill sc-pill-sm" data-ed="text-done" data-testid="button-text-done">Done</button></div>
        <div class="sc-texted-mid"><textarea class="sc-textarea" rows="1" maxlength="400" aria-label="Status text" placeholder="Type something" data-testid="input-status-text"></textarea></div>
        <div class="sc-optrow" role="toolbar" aria-label="Text style" data-testid="row-text-options">
          ${STATUS_TEXT_STYLES.map(s => `<button type="button" class="sc-chip" data-style="${s}" aria-pressed="false" data-testid="button-style-${s}">${STYLE_LABELS[s]}</button>`).join("")}
          <span class="sc-sep" aria-hidden="true"></span><span class="sc-optlabel">Text</span>
          ${STATUS_COLORS.map(c => sw("text-color", c)).join("")}
          <span class="sc-sep" aria-hidden="true"></span><span class="sc-optlabel">Bg</span>
          ${STATUS_COLORS.map(c => sw("bg-color", c)).join("")}
        </div>
      </div>
      <div class="sc-stk-ctl" hidden role="toolbar" aria-label="Sticker controls" data-testid="toolbar-sticker">
        <button type="button" class="sc-icon" data-ed="stk-edit" aria-label="Edit sticker text" data-testid="button-sticker-edit">${ICON.edit}</button>
        <button type="button" class="sc-icon" data-ed="stk-bigger" aria-label="Make sticker larger" data-testid="button-sticker-bigger">${ICON.bigger}</button>
        <button type="button" class="sc-icon" data-ed="stk-smaller" aria-label="Make sticker smaller" data-testid="button-sticker-smaller">${ICON.smaller}</button>
        <button type="button" class="sc-icon" data-ed="stk-remove" aria-label="Remove sticker" data-testid="button-sticker-remove">${ICON.trash}</button>
        <button type="button" class="sc-pill sc-pill-sm" data-ed="stk-done" data-testid="button-sticker-done">Done</button>
      </div>
      <div class="sc-ov-ctl" hidden role="toolbar" aria-label="Picture controls" data-testid="toolbar-overlay">
        <button type="button" class="sc-icon" data-ed="ov-bigger" aria-label="Make picture larger" data-testid="button-overlay-bigger">${ICON.bigger}</button>
        <button type="button" class="sc-icon" data-ed="ov-smaller" aria-label="Make picture smaller" data-testid="button-overlay-smaller">${ICON.smaller}</button>
        <button type="button" class="sc-icon" data-ed="ov-remove" aria-label="Remove picture" data-testid="button-overlay-remove">${ICON.trash}</button>
        <button type="button" class="sc-pill sc-pill-sm" data-ed="ov-done" data-testid="button-overlay-done">Done</button>
      </div>
      <section class="sc-stk-picker" hidden aria-label="Stickers" data-testid="sticker-picker">
        <header><b>Stickers</b><button type="button" class="sc-icon" data-ed="stickers-close" aria-label="Close stickers" data-testid="button-close-stickers">${ICON.close}</button></header>
        <div class="sc-stk-row" role="list"></div>
      </section>
      <form class="sc-stk-form" hidden aria-label="Edit sticker" data-testid="form-sticker">
        <label><span>Title <small>optional</small></span><input name="title" maxlength="${TITLE_MAX}" autocomplete="off" data-testid="input-sticker-title"></label>
        <label><span class="sc-stk-prompt-label">Prompt</span><textarea name="prompt" rows="2" maxlength="${PROMPT_MAX}" data-testid="input-sticker-prompt"></textarea></label>
        <label class="sc-stk-answer"><span>Your answer</span><textarea name="answer" rows="3" maxlength="${ANSWER_MAX}" placeholder="Write an answer, or reply with your photo and canvas text" data-testid="input-sticker-answer"></textarea></label>
        <div class="sc-stk-form-row"><button type="button" class="sc-pill sc-pill-ghost sc-pill-sm" data-ed="stk-form-cancel">Cancel</button><button type="submit" class="sc-pill sc-pill-sm" data-testid="button-sticker-save">Save</button></div>
      </form>
      <footer class="sc-send">
        <div class="sc-audience" role="radiogroup" aria-label="Audience"></div>
        <p class="sc-disclosure" hidden data-testid="text-private-disclosure">Your account is private, so Status goes to Close friends.</p>
        <p class="sc-error" role="alert" hidden data-testid="text-send-error"></p>
        <button type="button" class="sc-sendbtn" data-ed="send" data-testid="button-send-status">Send to Status</button>
      </footer>`;
    editorKind = kind;
    renderAudience();
    const canvas = root.querySelector(".sc-canvas");
    const fit = () => {
      const dpr = Math.min(2, devicePixelRatio || 1), r = canvas.getBoundingClientRect();
      const w = Math.max(270, Math.round(r.width * dpr)), h = Math.round(w * 16 / 9);
      if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
    };
    fit(); listen(window, "resize", () => {
      fit();
      if (root.classList.contains("sc-typing")) {
        const layer = statusText();
        if (layer) syncTextarea(layer);
      }
    });
    const vv = window.visualViewport;
    if (vv) {
      const kb = () => root.style.setProperty("--sc-kb", `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`);
      listen(vv, "resize", () => {
        kb();
        if (root.classList.contains("sc-typing")) {
          const layer = statusText();
          if (layer) syncTextarea(layer);
        }
      });
      listen(vv, "scroll", kb); kb();
    }
    wireCanvas(canvas);
    mentionCleanup();
    const mentionField = root.querySelector(".sc-textarea");
    void loadApi().then(api => {
      if (!closed && mentionField?.isConnected) mentionCleanup = bindMentionAutocomplete(mentionField, { api });
    }).catch(error => console.warn("Mention suggestions could not load.", error));
    const form = root.querySelector(".sc-stk-form");
    form.addEventListener("submit", event => { event.preventDefault(); saveStickerForm(); });
    listen(document, "keydown", stickerKeys);
    listen(document, "keydown", overlayKeys, true);
    syncFit(); syncOverlayControls(); renderStickerPicker(); syncStickerControls();
    if (video) video.play().catch(() => {});
    const loop = () => { if (closed || !project) return; paint(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    root.querySelector(".sc-edit").addEventListener("click", editorClick);
    root.querySelector(".sc-textarea").addEventListener("input", e => {
      const layer = statusText(); if (!layer) return;
      layer.text = e.target.value; dirty = true; fitStatusText(layer); syncTextarea(layer);
    });
  }
  function paint() {
    const canvas = root.querySelector(".sc-canvas"); if (!canvas || !project || !M) return;
    // selectedId is always null: no selection box or handles in Status.
    M.drawProject(canvas, project, assets, () => null, video ? video.currentTime : 0, null, { preview: true });
    drawStatusStickers(canvas, stickers, canvas.width, canvas.height, { selectedId: selectedStickerId });
  }
  // ---------------- Stickers ----------------
  const selectedSticker = () => stickers.find(s => s.id === selectedStickerId) || null;
  function renderStickerPicker() {
    const row = root.querySelector(".sc-stk-row"), panel = root.querySelector(".sc-stk-picker"); if (!row || !panel) return;
    panel.hidden = !stickerPickerOpen;
    root.querySelector('[data-ed="stickers"]')?.setAttribute("aria-expanded", String(stickerPickerOpen));
    row.innerHTML = PICKER_KINDS.map(kind => {
      const used = stickers.some(s => s.kind === kind), full = !canAddSticker(stickers, kind);
      return `<button type="button" role="listitem" class="sc-stk-card sc-stk-${kind}" data-add-sticker="${kind}" ${full ? "disabled" : ""} data-testid="button-add-sticker-${kind}">
        <span class="sc-stk-thumb" aria-hidden="true"><span class="sc-stk-mini sc-stk-mini-${kind}">
          <b>${kind === "questions" ? "QUESTIONS" : "ADD YOURS"}</b><i>${kind === "questions" ? "Ask me anything" : "Share your take"}</i>
          <em>${kind === "questions" ? "Write a reply…" : "+  Add Yours"}</em></span></span>
        <b>${esc(STICKER_LABELS[kind])}</b><small>${used ? "Added" : full ? "Limit reached" : kind === "questions" ? "Let people ask you" : "Invite people to add their own"}</small></button>`;
    }).join("");
  }
  function syncStickerControls() {
    const bar = root.querySelector(".sc-stk-ctl"); if (!bar) return;
    const s = selectedSticker();
    bar.hidden = !s || !!stickerFormId || drawMode;
    if (s) {
      bar.querySelector('[data-ed="stk-bigger"]').disabled = s.width >= .95;
      bar.querySelector('[data-ed="stk-smaller"]').disabled = s.width <= .29;
    }
    root.querySelector(".sc-send").hidden = drawMode || !!stickerFormId;
  }
  function selectSticker(id) { selectedStickerId = id; if (id && selectedOverlayId) { selectedOverlayId = null; syncOverlayControls(); } if (id) { stickerPickerOpen = false; renderStickerPicker(); } syncStickerControls(); }
  function openStickerForm(s) {
    if (!s) return;
    const form = root.querySelector(".sc-stk-form");
    stickerFormId = s.id; form.hidden = false;
    form.elements.title.value = s.title || ""; form.elements.prompt.value = s.prompt || "";
    form.elements.prompt.placeholder = DEFAULT_PROMPTS[s.kind] || "";
    // Answers keep the original question verbatim (up to 300 chars): shown read-only, never re-sent edited.
    const answering = s.kind === "answer";
    form.elements.prompt.readOnly = answering;
    form.elements.prompt.maxLength = answering ? ANSWER_PROMPT_MAX : PROMPT_MAX;
    form.querySelector(".sc-stk-prompt-label").textContent = answering ? "Question" : "Prompt";
    form.querySelector(".sc-stk-answer").hidden = s.kind !== "answer";
    form.elements.answer.value = s.answer || "";
    root.classList.add("sc-stk-editing"); syncStickerControls();
    requestAnimationFrame(() => (s.kind === "answer" ? form.elements.answer : form.elements.prompt).focus());
  }
  function closeStickerForm() {
    const form = root.querySelector(".sc-stk-form"); if (form) form.hidden = true;
    stickerFormId = null; root.classList.remove("sc-stk-editing"); syncStickerControls();
  }
  function saveStickerForm() {
    const s = stickers.find(x => x.id === stickerFormId), form = root.querySelector(".sc-stk-form");
    if (s && form) { updateStickerText(s, { title: form.elements.title.value.trim(), prompt: s.kind === "answer" ? undefined : form.elements.prompt.value.trim(), answer: form.elements.answer.value.trim() }); dirty = true; }
    closeStickerForm();
  }
  function stickerKeys(event) {
    const s = selectedSticker();
    if (!s || stickerFormId || editingId || closed) return;
    if (event.target.closest?.("input,textarea,select,[contenteditable=true]")) return;
    const step = event.shiftKey ? .05 : .015;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) { event.preventDefault(); moveSticker(s, ...moves[event.key]); dirty = true; }
    else if (event.key === "+" || event.key === "=") { event.preventDefault(); resizeSticker(s, 1.1); dirty = true; syncStickerControls(); }
    else if (event.key === "-") { event.preventDefault(); resizeSticker(s, 1 / 1.1); dirty = true; syncStickerControls(); }
    else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSticker(stickers, s.id); selectSticker(null); renderStickerPicker(); dirty = true; }
    else if (event.key === "Enter") { event.preventDefault(); openStickerForm(s); }
  }
  // ---------------- Picture overlays ----------------
  const selectedOverlay = () => project?.layers.find(l => l.id === selectedOverlayId && l.statusOverlay) || null;
  function syncOverlayControls() {
    const bar = root.querySelector(".sc-ov-ctl"); if (!bar) return;
    const l = selectedOverlay();
    bar.hidden = !l || drawMode || !!stickerFormId;
    if (l) {
      bar.querySelector('[data-ed="ov-bigger"]').disabled = l.scale >= 4;
      bar.querySelector('[data-ed="ov-smaller"]').disabled = l.scale <= .2;
    }
    const add = root.querySelector('[data-ed="overlay"]');
    if (add) { const full = overlaySlots(project?.layers) === 0; add.disabled = busy || full; add.setAttribute("aria-label", full ? `Picture limit reached (${MAX_OVERLAYS})` : "Add picture overlay"); }
  }
  function selectOverlay(id) {
    selectedOverlayId = id;
    if (id) { selectedStickerId = null; syncStickerControls(); }
    syncOverlayControls();
  }
  function removeOverlay(l) {
    project.layers = project.layers.filter(x => x !== l);
    selectedOverlayId = null; dirty = true; syncOverlayControls();
  }
  async function addOverlays(files) {
    if (!project || !M || !assets) return;
    const seq = openSeq, room = overlaySlots(project.layers);
    const picked = files.filter(isOverlayFile);
    if (picked.length < files.length) toast("Pictures can be JPEG, PNG or WebP.");
    if (picked.length > room) toast(room ? `Only ${room} more picture${room === 1 ? "" : "s"} fit (max ${MAX_OVERLAYS}).` : `You can add up to ${MAX_OVERLAYS} pictures.`);
    let added = null, failed = 0;
    for (const file of picked.slice(0, room)) {
      const url = own(file);
      try {
        const img = await assets.load(url, "image");
        if (closed || seq !== openSeq || !project) return;
        if (!img) throw new Error("decode");
        const count = project.layers.filter(l => l.statusOverlay).length;
        if (count >= MAX_OVERLAYS) break;
        const size = overlaySize(img.naturalWidth || img.width, img.naturalHeight || img.height, project.width, project.height);
        const layer = M.createLayer("image", { media: url, ...size, ...overlayPosition(count), endTime: 3600, statusOverlay: true });
        project.layers.splice(overlayInsertIndex(project.layers), 0, layer);
        added = layer; dirty = true;
      } catch (error) {
        console.error("[status-capture] overlay", error);
        failed++; URL.revokeObjectURL(url); owned.delete(url);
      }
    }
    if (failed) toast(failed === 1 ? "One picture couldn't be opened. Everything else is unchanged." : `${failed} pictures couldn't be opened. Everything else is unchanged.`);
    if (added) selectOverlay(added.id); else syncOverlayControls();
  }
  overlayInput.addEventListener("change", () => {
    const files = [...(overlayInput.files || [])];
    overlayInput.value = ""; // allow picking the same file again
    if (files.length) void addOverlays(files);
  });
  function overlayKeys(event) {
    const l = selectedOverlay();
    if (!l || editingId || stickerFormId || closed || selectedStickerId) return;
    if (event.target.closest?.("input,textarea,select,[contenteditable=true]")) return;
    const step = event.shiftKey ? .05 : .015;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) { event.preventDefault(); moveOverlay(l, ...moves[event.key]); dirty = true; }
    else if (event.key === "+" || event.key === "=") { event.preventDefault(); scaleOverlay(l, 1.1); dirty = true; syncOverlayControls(); }
    else if (event.key === "-") { event.preventDefault(); scaleOverlay(l, 1 / 1.1); dirty = true; syncOverlayControls(); }
    else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeOverlay(l); }
    else if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); selectOverlay(null); }
  }
  function syncFit() {
    const b = root.querySelector('[data-ed="fit"]'); if (!b || !project?.background) return;
    const fitted = project.background.fit === "contain";
    b.textContent = fitted ? "Fill" : "Fit";
    b.setAttribute("aria-label", fitted ? "Fill the screen" : "Show the full photo or video");
    b.setAttribute("aria-pressed", String(fitted));
  }
  const statusText = () => project?.layers.find(l => l.id === statusTextId) || null;
  // Active label for typing/style. point -> place a new (or reused empty) label there; fresh -> new centered label.
  function ensureStatusText({ point = null, fresh = false } = {}) {
    let layer = statusText();
    if (layer && !point && !fresh) return layer;
    if (!M || !project) return null;
    const draft = emptyDraft(project.layers);
    if (draft) layer = draft;
    else {
      if (!canAddLabel(project.layers)) { toast(`You can add up to ${MAX_TEXT_LABELS} text labels. Edit an existing one instead.`); return null; }
      const prev = statusText();
      layer = M.createLayer("text", { text: "", endTime: 3600, statusLabel: true });
      project.layers.push(layer);
      applyStatusStyle(layer, prev?.statusStyle || "classic");
      if (prev) layer.color = prev.color;
    }
    const at = placementPoint(point || { x: .5, y: .5 });
    if (point || fresh || draft) { layer.x = at.x; layer.y = at.y; }
    statusTextId = layer.id;
    return layer;
  }
  // Style changes apply to the active label only and keep its placement.
  function applyStatusStyle(layer, style) {
    const place = { x: layer.x ?? .5, y: layer.y ?? .5, scale: layer.scale ?? 1, rotation: layer.rotation ?? 0 };
    Object.assign(layer, statusTextStyle(style, layer.color, layer.background, editorKind === "text" ? null : layer.background));
    fitStatusText(layer);
    Object.assign(layer, place);
  }
  function fitStatusText(layer) {
    measureCtx ||= document.createElement("canvas").getContext("2d");
    const place = { x: layer.x ?? .5, y: layer.y ?? .5, scale: layer.scale ?? 1, rotation: layer.rotation ?? 0 };
    Object.assign(layer, fitTextLayout(measureCtx, M, layer, editorKind === "text"), place);
  }
  function syncTextarea(layer) {
    const ta = root.querySelector(".sc-textarea"); if (!ta) return;
    ta.style.color = layer.color;
    ta.style.fontFamily = M.textStyle(layer).family;
    ta.style.fontWeight = layer.bold === false ? "400" : "700";
    ta.style.textShadow = layer.shadow ? "0 2px 8px rgba(0,0,0,.55)" : "none";
    ta.style.background = layer.backgroundOn ? layer.background : "transparent";
    const fitField = () => {
      if (!ta.isConnected) return;
      const available = root.querySelector(".sc-texted-mid")?.clientHeight || window.innerHeight * .4;
      const maxHeight = Math.max(48, Math.min(window.innerHeight * .4, available - 16));
      let size = Math.max(18, Math.min(34, (layer.fontSize || 64) * .3));
      ta.style.maxHeight = `${maxHeight}px`;
      ta.style.height = "auto";
      ta.style.fontSize = `${size}px`;
      while (ta.scrollHeight > maxHeight && size > 16) ta.style.fontSize = `${--size}px`;
      ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
    };
    fitField();
    requestAnimationFrame(fitField);
    for (const b of root.querySelectorAll("[data-style]")) b.setAttribute("aria-pressed", String(b.dataset.style === layer.statusStyle));
    for (const b of root.querySelectorAll("[data-text-color]")) b.setAttribute("aria-pressed", String(b.dataset.textColor === layer.color));
    const bg = editorKind === "text" ? project.background.color : layer.backgroundOn ? layer.background : "";
    for (const b of root.querySelectorAll("[data-bg-color]")) b.setAttribute("aria-pressed", String(b.dataset.bgColor === bg));
  }
  function openTextEditor({ layer: target = null, point = null, fresh = false } = {}) {
    if (drawMode) toggleDraw();
    if (target) statusTextId = target.id;
    const layer = target || ensureStatusText({ point, fresh }); if (!layer) return;
    editingId = layer.id; layer.opacity = 0; // the textarea shows it while typing
    root.classList.add("sc-typing");
    const ed = root.querySelector(".sc-texted"), ta = root.querySelector(".sc-textarea");
    ed.hidden = false; ta.value = layer.text; syncTextarea(layer);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
  }
  function finishText() {
    const layer = statusText();
    root.querySelector(".sc-texted").hidden = true; root.classList.remove("sc-typing");
    root.querySelector(".sc-textarea")?.blur();
    if (layer) {
      layer.opacity = 1;
      if (!layer.text.trim()) { project.layers = project.layers.filter(l => l !== layer); statusTextId = null; }
      else fitStatusText(layer);
    }
    editingId = null;
  }
  async function editorClick(event) {
    const t = event.target.closest("[data-ed],[data-add-sticker],[data-draw-color],[data-bg-color],[data-text-color],[data-aud],[data-style]");
    if (!t || busy) return;
    if (t.dataset.drawColor) { drawColor = t.dataset.drawColor; for (const b of root.querySelectorAll("[data-draw-color]")) b.setAttribute("aria-pressed", String(b === t)); return; }
    if (t.dataset.style) { const l = statusText(); if (l) { applyStatusStyle(l, t.dataset.style); syncTextarea(l); dirty = true; } return; }
    if (t.dataset.textColor) { const l = statusText(); if (l) { l.color = t.dataset.textColor; syncTextarea(l); dirty = true; } return; }
    if (t.dataset.bgColor) {
      const l = statusText();
      if (editorKind === "text") project.background.color = t.dataset.bgColor;
      else if (l) { l.background = t.dataset.bgColor; if (!l.backgroundOn) applyStatusStyle(l, "box"); }
      if (l) syncTextarea(l); dirty = true; return;
    }
    if (t.dataset.aud) { if (!t.disabled) { audience = t.dataset.aud; renderAudience(); } return; }
    if (t.dataset.addSticker) {
      if (t.disabled) return;
      const s = addSticker(stickers, t.dataset.addSticker);
      if (s) { dirty = true; stickerPickerOpen = false; renderStickerPicker(); selectSticker(s.id); }
      return;
    }
    const act = t.dataset.ed;
    if (act === "overlay") {
      if (drawMode) toggleDraw(); if (editingId) finishText();
      stickerPickerOpen = false; renderStickerPicker();
      if (overlaySlots(project?.layers) === 0) { toast(`You can add up to ${MAX_OVERLAYS} pictures.`); return; }
      overlayInput.value = ""; overlayInput.click(); return;
    }
    if (act?.startsWith("ov-")) {
      const l = selectedOverlay();
      if (act === "ov-done") selectOverlay(null);
      else if (l && act === "ov-bigger") { scaleOverlay(l, 1.12); dirty = true; syncOverlayControls(); }
      else if (l && act === "ov-smaller") { scaleOverlay(l, 1 / 1.12); dirty = true; syncOverlayControls(); }
      else if (l && act === "ov-remove") removeOverlay(l);
      return;
    }
    if (act === "stickers") { if (drawMode) toggleDraw(); if (editingId) finishText(); stickerPickerOpen = !stickerPickerOpen; if (stickerPickerOpen) selectedStickerId = null; renderStickerPicker(); syncStickerControls(); return; }
    if (act === "stickers-close") { stickerPickerOpen = false; renderStickerPicker(); return; }
    if (act === "fit" && project?.background) {
      project.background.fit = project.background.fit === "contain" ? "cover" : "contain";
      project.background.statusTransform = { x: 0, y: 0, scale: 1 }; dirty = true; syncFit(); return;
    }
    if (act?.startsWith("stk-")) {
      const s = selectedSticker();
      if (act === "stk-form-cancel") closeStickerForm();
      else if (act === "stk-done") selectSticker(null);
      else if (s && act === "stk-edit") openStickerForm(s);
      else if (s && act === "stk-bigger") { resizeSticker(s, 1.12); dirty = true; syncStickerControls(); }
      else if (s && act === "stk-smaller") { resizeSticker(s, 1 / 1.12); dirty = true; syncStickerControls(); }
      else if (s && act === "stk-remove") { removeSticker(stickers, s.id); selectSticker(null); renderStickerPicker(); dirty = true; }
      return;
    }
    if (act === "back") {
      if (dirty && !window.confirm("Discard this Status? It hasn't been sent.")) return;
      selectedStickerId = null; stickerFormId = null; stickerPickerOpen = false; selectedOverlayId = null;
      if (source === "seed") { close(true); return; }
      dirty = false; video?.pause(); try { assets?.dispose(); } catch {} assets = null; video = null;
      if (source === "camera") { showCapture(); startCamera(); } else showLanding();
    } else if (act === "text") openTextEditor({ fresh: true });
    else if (act === "emoji") {
      if (drawMode) toggleDraw();
      const { openEmojiPicker } = await import("./emoji.js");
      // Emoji join the centered status text; never free-placed or selected.
      openEmojiPicker(t, emoji => {
        if (!emoji || closed || !project) return;
        const l = ensureStatusText(); if (!l) return;
        l.text = `${l.text}${l.text && !/\s$/.test(l.text) ? " " : ""}${emoji}`; l.opacity = 1;
        fitStatusText(l); dirty = true;
        if (editingId) { const ta = root.querySelector(".sc-textarea"); ta.value = l.text; syncTextarea(l); l.opacity = 0; }
      }, { selectOnly: true, container: root, category: "Smileys" });
    }
    else if (act === "draw") toggleDraw();
    else if (act === "undo") { const d = project.layers.find(l => l.kind === "drawing"); if (d?.strokes.length) { d.strokes.pop(); d.revision++; } }
    else if (act === "text-done") finishText();
    else if (act === "sound" && video) {
      // Only unmuted from this explicit tap.
      video.muted = !video.muted; if (!video.muted) video.play().catch(() => {});
      t.innerHTML = video.muted ? ICON.muted : ICON.sound; t.setAttribute("aria-label", video.muted ? "Play sound" : "Mute");
    }
    else if (act === "send") send();
  }
  function toggleDraw() {
    if (editorKind === "text" || !M) return;
    drawMode = !drawMode;
    if (drawMode) { selectedStickerId = null; selectedOverlayId = null; stickerPickerOpen = false; renderStickerPicker(); }
    root.querySelector(".sc-drawbar").hidden = !drawMode;
    root.querySelector('[data-ed="draw"]')?.setAttribute("aria-pressed", String(drawMode));
    syncStickerControls(); syncOverlayControls();
    if (drawMode && !project.layers.some(l => l.kind === "drawing")) {
      // Keep the status text on top of strokes.
      const layer = M.createLayer("drawing", { width: project.width, height: project.height, strokes: [], revision: 0, endTime: 3600, color: drawColor, strokeWidth: 14 });
      const i = project.layers.findIndex(l => l.id === statusTextId);
      if (i >= 0) project.layers.splice(i, 0, layer); else project.layers.push(layer);
    }
  }
  function wireCanvas(canvas) {
    let drag = null;
    const point = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * project.width, y: (e.clientY - r.top) / r.height * project.height }; };
    const norm = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, px: e.clientX, py: e.clientY }; };
    // ---- Drawing (unchanged) ----
    canvas.addEventListener("pointerdown", e => {
      if (busy || editingId || !M || !drawMode) return;
      canvas.setPointerCapture?.(e.pointerId);
      const d = project.layers.find(l => l.kind === "drawing"); if (!d) return;
      const p = point(e);
      const stroke = { color: drawColor, width: 14, points: [{ x: p.x - project.width / 2, y: p.y - project.height / 2 }] };
      d.strokes.push(stroke); d.revision++; dirty = true; drag = { stroke, d };
    });
    canvas.addEventListener("pointermove", e => {
      if (!drag) return; const p = point(e);
      drag.stroke.points.push({ x: p.x - project.width / 2, y: p.y - project.height / 2 }); drag.d.revision++;
    });
    const end = () => { drag = null; };
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);

    // ---- Move / pinch (outside drawing): stickers, text, then media ----
    const pointers = new Map();
    let gesture = null, suppressClick = false;
    const textHit = p => hitTextLabel(project.layers, p.x, p.y, project.width, project.height);
    const legacyTextHit = (p) => {
      const l = statusText(); if (!l || !l.text?.trim() || l.statusLabel) return null;
      const lines = Math.max(1, String(l.text).split("\n").length);
      const w = (l.width || 760) * (l.scale || 1) / project.width, h = (l.fontSize || 64) * 1.3 * lines * (l.scale || 1) / project.height;
      return Math.abs(p.x - l.x) <= w / 2 + .03 && Math.abs(p.y - l.y) <= h / 2 + .03 ? l : null;
    };
    const targetAt = p => {
      const s = hitSticker(stickers, p.x, p.y, 9 / 16); if (s) return { type: "sticker", item: s };
      const l = textHit(p) || legacyTextHit(p); if (l) return { type: "text", item: l };
      const o = hitOverlay(project.layers, p.x, p.y, project.width, project.height); if (o) return { type: "overlay", item: o };
      if (project.background?.media) return { type: "media", item: project.background };
      return null;
    };
    const snapshot = t => t.type === "sticker" ? { x: t.item.x, y: t.item.y, width: t.item.width, height: t.item.height, rotation: t.item.rotation }
      : t.type === "text" || t.type === "overlay" ? { x: t.item.x, y: t.item.y, scale: t.item.scale || 1, rotation: t.item.rotation || 0 }
        : { ...clampMediaTransform(t.item.statusTransform) };
    const begin = () => {
      const pts = [...pointers.values()];
      const target = gesture?.target || targetAt(pts[0]);
      gesture = target ? { target, start: snapshot(target), p0: pts.map(p => ({ ...p })), moved: gesture?.moved || false } : null;
    };
    canvas.addEventListener("pointerdown", e => {
      if (busy || editingId || stickerFormId || !M || drawMode) return;
      if (pointers.size >= 2) return;
      canvas.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, norm(e));
      begin();
    });
    canvas.addEventListener("pointermove", e => {
      if (!pointers.has(e.pointerId) || !gesture) return;
      pointers.set(e.pointerId, norm(e));
      const pts = [...pointers.values()], { target, start, p0 } = gesture;
      if (!gesture.moved && Math.hypot(pts[0].px - p0[0].px, pts[0].py - p0[0].py) < 6 && pts.length < 2) return;
      gesture.moved = true; dirty = true;
      let dx = pts[0].x - p0[0].x, dy = pts[0].y - p0[0].y, k = 1, rot = 0;
      if (pts.length >= 2 && p0.length >= 2) {
        // Pinch in screen-proportional space (y scaled by 16/9 so rotation angles are true).
        const sp = q => ({ x: q.x * 9, y: q.y * 16 });
        const d = pinchDelta(sp(p0[0]), sp(p0[1]), sp(pts[0]), sp(pts[1]));
        dx = d.dx / 9; dy = d.dy / 16; k = d.scale; rot = d.rotation;
      }
      if (target.type === "sticker") {
        const s = target.item;
        s.x = start.x + dx; s.y = start.y + dy; s.rotation = start.rotation + rot;
        s.width = start.width * k; s.height = start.height * k;
        clampSticker(s);
        if (selectedStickerId !== s.id) selectSticker(s.id);
      } else if (target.type === "overlay") {
        const o = target.item;
        o.x = Math.min(1, Math.max(0, start.x + dx)); o.y = Math.min(1, Math.max(0, start.y + dy));
        o.scale = Math.min(4, Math.max(.2, start.scale * k)); o.rotation = start.rotation + rot;
        if (selectedOverlayId !== o.id) selectOverlay(o.id);
      } else if (target.type === "text") {
        const l = target.item;
        l.x = Math.min(.98, Math.max(.02, start.x + dx)); l.y = Math.min(.98, Math.max(.02, start.y + dy));
        l.scale = Math.min(4, Math.max(.3, start.scale * k)); l.rotation = start.rotation + rot;
      } else {
        target.item.statusTransform = clampMediaTransform({ x: start.x + dx, y: start.y + dy, scale: start.scale * k });
      }
    });
    const release = e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (gesture?.moved) suppressClick = true;
      if (pointers.size) begin(); // continue with the remaining finger from its current position
      else { if (gesture?.target.type === "sticker" && gesture.moved) syncStickerControls(); gesture = null; }
    };
    canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("click", e => {
      if (suppressClick) { suppressClick = false; return; }
      if (drawMode || busy || editingId || stickerFormId || !M) return;
      const p = norm(e);
      const s = hitSticker(stickers, p.x, p.y, 9 / 16);
      if (s) { if (selectedStickerId === s.id) openStickerForm(s); else selectSticker(s.id); return; }
      const ov = !textHit(p) && hitOverlay(project.layers, p.x, p.y, project.width, project.height);
      if (ov) { selectOverlay(ov.id); return; }
      if (selectedOverlayId) { selectOverlay(null); return; }
      if (selectedStickerId || stickerPickerOpen) { stickerPickerOpen = false; renderStickerPicker(); selectSticker(null); return; }
      const label = textHit(p);
      if (label) { openTextEditor({ layer: label }); return; }
      openTextEditor({ point: p }); // tap anywhere places a new label there
    });
  }
  function renderAudience() {
    const box = root.querySelector(".sc-audience"); if (!box) return;
    if (isPrivate && audience === "public") audience = "close-friends";
    box.innerHTML = statusAudiences(isPrivate).map(o => `<button type="button" role="radio" class="sc-aud${o.value === "close-friends" ? " sc-aud-cf" : ""}" data-aud="${o.value}" aria-checked="${audience === o.value}" ${o.allowed && privacyKnown ? "" : "disabled"} data-testid="button-audience-${o.value}">${o.label}</button>`).join("");
    const disc = root.querySelector(".sc-disclosure"); if (disc) disc.hidden = !isPrivate;
    const send = root.querySelector(".sc-sendbtn"); if (send && !busy) send.disabled = !privacyKnown;
  }
  function setBusy(on, label = "Send to Status") {
    busy = on; root.classList.toggle("sc-busy", on);
    const btn = root.querySelector(".sc-sendbtn"); if (btn) { btn.disabled = on; btn.textContent = label; }
    for (const b of root.querySelectorAll(".sc-edit button:not(.sc-sendbtn)")) b.disabled = on || (b.dataset.aud === "public" && isPrivate);
  }
  async function send() {
    if (busy || sent || !project) return;
    if (editingId) finishText();
    if (stickerFormId) saveStickerForm();
    selectedStickerId = null; selectedOverlayId = null; stickerPickerOpen = false; renderStickerPicker(); syncStickerControls(); syncOverlayControls();
    const err = root.querySelector(".sc-error"); err.hidden = true;
    if (isPrivate && audience === "public") audience = "close-friends";
    if (source === "text" && !sourceBlob && !project.layers.some(l => (l.kind === "text" && l.text.trim()) || l.kind === "emoji" || (l.kind === "image" && l.media) || (l.kind === "drawing" && l.strokes.length)) && !stickers.length) {
      err.textContent = "Add text, a picture or a sticker first."; err.hidden = false; return;
    }
    setBusy(true, video ? "Preparing video…" : "Preparing…");
    let blob;
    try {
      await validateSource?.();
      const m = await loadMods();
      await loadStickerArt(stickers.map(s => s.kind), { required: true });
      const out = document.createElement("canvas"); out.width = project.width; out.height = project.height;
      if (video) {
        video.pause();
        let alive = true; cleanups.push(() => { alive = false; });
        blob = await m.exportCreativeVideo({
          canvas: out, video, background: project.background, duration: project.duration, sourceBlob,
          render: (time, target) => { m.drawProject(target, project, assets, () => null, time, null, {}); drawStatusStickers(target, stickers, target.width, target.height); },
          alive: () => alive && !closed,
        });
      } else {
        m.drawProject(out, project, assets, () => null, 0, null, {});
        drawStatusStickers(out, stickers, out.width, out.height);
        blob = await m.canvasBlob(out);
      }
      out.width = 0;
    } catch (error) {
      if (closed) return;
      setBusy(false); renderAudience(); err.textContent = friendlyError(error, "Couldn't prepare your Status. It's still here; try again."); err.hidden = false;
      if (video) video.play().catch(() => {});
      return;
    }
    try {
      setBusy(true, "Sending…");
      await validateSource?.();
      const a = await loadApi();
      project.statusStickers = publishStickers(stickers);
      const story = await a.createCloudStory({ text: joinLabelText(project.layers, shareText), visibility: audience, mediaBlob: blob, stickers: project.statusStickers, answerQuestionId: seedQuestionId });
      sent = true;
      toast("Sent to Status");
      try { onPosted?.(story); } catch (e) { console.error(e); }
      close(true);
    } catch (error) {
      if (error?.publishedId) {
        sent = true; toast("Sent to Status. Refresh if it isn't visible yet.");
        try { onPosted?.({ id: error.publishedId }); } catch (e) { console.error(e); }
        close(true); return;
      }
      if (closed) return;
      setBusy(false); renderAudience();
      if (video) video.play().catch(() => {});
      const privacy = /private account/i.test(error?.message || "");
      if (privacy) { isPrivate = true; audience = "close-friends"; renderAudience(); }
      err.textContent = privacy ? "Your account is private. Status was switched to Close friends; tap send again." : error?.code === "STATUS_SERVER_NOT_READY" ? error.message : friendlyError(error, "Couldn't send your Status. It's still here; try again.");
      err.hidden = false;
    }
  }

  // ---------------- Boot ----------------
  if (seeded) openEditor("seed", null, 0, { background, initialProject });
  else if (source === "text") openEditor("text");
  else if (source === "camera") { showCapture(); startCamera(); }
  else showLanding();
  return { close: () => close() };
}
