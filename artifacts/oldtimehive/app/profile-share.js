// Profile QR card + on-device scanner overlay. Plain JS, no app state.
// Never logs/stores image bytes, frames or credentials. Never navigates scanned URLs.
import QRCode from "qrcode";
import jsQR from "jsqr";

const ALLOWED_HOSTS = new Set(["www.heyoldtime.com", "heyoldtime.com"]);
const USERNAME_RE = /^[A-Za-z0-9_.]{1,30}$/;
const SCAN_MAX_DIM = 640;
const SCAN_INTERVAL_MS = 180;

/** Pure: returns { ok:true, username } or { ok:false, reason }. */
export function parseOldtimeProfileCode(value) {
  if (typeof value !== "string") return { ok: false, reason: "empty" };
  const raw = value.trim();
  if (!raw || raw.length > 512) return { ok: false, reason: "empty" };
  if (/[\s\u0000-\u001f\u007f\\]/.test(raw)) return { ok: false, reason: "invalid" };
  if (!/^https:\/\//i.test(raw)) return { ok: false, reason: "not-oldtime" };
  let u;
  try { u = new URL(raw); } catch { return { ok: false, reason: "invalid" }; }
  if (u.protocol !== "https:") return { ok: false, reason: "not-oldtime" };
  if (u.username || u.password) return { ok: false, reason: "not-oldtime" };
  if (u.port) return { ok: false, reason: "not-oldtime" };
  if (!ALLOWED_HOSTS.has(u.hostname)) return { ok: false, reason: "not-oldtime" };
  if (u.pathname !== "/" ) return { ok: false, reason: "not-profile" };
  if (u.hash) return { ok: false, reason: "not-profile" };
  const keys = [...u.searchParams.keys()];
  if (keys.length !== 1 || keys[0] !== "user") return { ok: false, reason: "not-profile" };
  const username = u.searchParams.get("user").replace(/^@/, "");
  if (!USERNAME_RE.test(username)) return { ok: false, reason: "not-profile" };
  return { ok: true, username };
}

const REASON_TEXT = {
  "not-oldtime": "This code isn't an Oldtime profile. It wasn't opened.",
  "not-profile": "This Oldtime link isn't a profile code.",
  invalid: "This code couldn't be read as a profile link.",
  empty: "No QR code found."
};

const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  share: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m20 16-4.5-4.5L6 20"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
  person: '<circle cx="12" cy="9" r="3.6"/><path d="M5 19.5c1.3-3.3 4-4.8 7-4.8s5.7 1.5 7 4.8"/>'
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

function el(tag, attrs = {}, html) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "text") node.textContent = v;
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  if (html != null) node.innerHTML = html;
  return node;
}

function safeAvatar(src) {
  if (typeof src !== "string" || !src) return "";
  try {
    const u = new URL(src, location.href);
    if (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "blob:") return u.href;
    if (u.protocol === "data:" && /^data:image\/(png|jpe?g|webp|gif);/i.test(src)) return src;
  } catch {}
  return "";
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch {}
  try {
    const ta = el("textarea", { readonly: true, "aria-hidden": "true", class: "ps-offscreen" });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}

export function openProfileShare({ user = {}, url, shareExternally, toast, onScanProfile } = {}) {
  const notify = typeof toast === "function" ? toast : () => {};
  const username = String(user.username || "").replace(/^@/, "");
  const displayName = String(user.displayName || user.name || username || "Oldtime member");
  const profileUrl = typeof url === "string" ? url : "";
  const opener = document.activeElement;
  const prevOverflow = document.body.style.overflow;

  let closed = false;
  let mode = "code";
  let stream = null;
  let video = null;
  let timer = 0;
  let camToken = 0;
  let detector = null;
  let busy = false;
  const work = document.createElement("canvas");
  const wctx = work.getContext("2d", { willReadFrequently: true });

  const root = el("div", { class: "ps-root", role: "presentation" });
  const scrim = el("div", { class: "ps-scrim" });
  const dialog = el("section", { class: "ps-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "ps-title", tabindex: "-1" });
  root.append(scrim, dialog);

  dialog.innerHTML = `
    <header class="ps-head">
      <button type="button" class="ps-icon-btn" data-act="back" aria-label="Close">${icon("close")}</button>
      <h2 id="ps-title" class="ps-title">Profile code</h2>
      <span class="ps-head-spacer"></span>
    </header>
    <div class="ps-tabs" role="tablist" aria-label="Profile code mode">
      <button type="button" role="tab" class="ps-tab" data-tab="code" aria-selected="true">${icon("qr")}<span>My code</span></button>
      <button type="button" role="tab" class="ps-tab" data-tab="scan" aria-selected="false">${icon("scan")}<span>Scan</span></button>
    </div>
    <div class="ps-body"></div>
    <input type="file" accept="image/*" class="ps-offscreen" tabindex="-1" aria-hidden="true" data-file>`;
  const body = dialog.querySelector(".ps-body");
  const fileInput = dialog.querySelector("[data-file]");
  const titleEl = dialog.querySelector("#ps-title");

  /* ---------- camera lifecycle ---------- */
  function stopCamera() {
    camToken++;
    if (timer) { clearTimeout(timer); timer = 0; }
    if (stream) { for (const t of stream.getTracks()) t.stop(); stream = null; }
    if (video) { try { video.pause(); } catch {} video.srcObject = null; video = null; }
  }

  function grab(source, w, h) {
    const scale = Math.min(1, SCAN_MAX_DIM / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    work.width = cw; work.height = ch;
    wctx.drawImage(source, 0, 0, cw, ch);
    const data = wctx.getImageData(0, 0, cw, ch);
    return data;
  }
  function wipe() { work.width = 1; work.height = 1; }

  async function decode(source, w, h) {
    if (detector) {
      try {
        const codes = await detector.detect(source);
        if (codes?.[0]?.rawValue) return codes[0].rawValue;
      } catch {}
    }
    const img = grab(source, w, h);
    const res = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
    wipe();
    return res?.data || "";
  }

  async function handleResult(text, statusEl) {
    const parsed = parseOldtimeProfileCode(text);
    if (!parsed.ok) {
      statusEl.textContent = REASON_TEXT[parsed.reason] || REASON_TEXT.invalid;
      statusEl.dataset.tone = "warn";
      return false;
    }
    stopCamera();
    statusEl.textContent = `Opening @${parsed.username}…`;
    statusEl.dataset.tone = "ok";
    if (typeof onScanProfile !== "function") return true;
    busy = true;
    try {
      await onScanProfile(parsed.username);
      close();
    } catch {
      if (closed) return true;
      statusEl.textContent = "Couldn't open that profile. Try again.";
      statusEl.dataset.tone = "warn";
    } finally { busy = false; }
    return true;
  }

  /* ---------- views ---------- */
  function renderCode() {
    titleEl.textContent = "Profile code";
    const avatar = safeAvatar(user.avatar);
    body.innerHTML = `
      <article class="ps-card" aria-label="Profile code for @${escapeHtml(username)}">
        <div class="ps-card-brand"><img src="/brand/oldtime-app-icon.png" alt="" width="22" height="22"><span>Oldtime</span></div>
        <div class="ps-ident">
          <div class="ps-avatar">${avatar ? `<img alt="" src="${escapeAttr(avatar)}">` : icon("person")}</div>
          <div class="ps-names"><b>${escapeHtml(displayName)}</b><small>@${escapeHtml(username)}</small></div>
        </div>
        <div class="ps-qr" data-qr aria-busy="true"><div class="ps-qr-skeleton"></div></div>
        <p class="ps-card-hint">Scan with a phone camera to open this profile.</p>
      </article>
      <p class="ps-link" title="${escapeAttr(profileUrl)}">${escapeHtml(profileUrl.replace(/^https:\/\//, ""))}</p>
      <div class="ps-actions">
        <button type="button" class="ps-btn ps-btn-ghost" data-act="copy">${icon("copy")}<span>Copy link</span></button>
        <button type="button" class="ps-btn ps-btn-primary" data-act="share">${icon("share")}<span>Share</span></button>
      </div>`;
    const img = body.querySelector(".ps-avatar img");
    if (img) img.addEventListener("error", () => { img.parentElement.innerHTML = icon("person"); }, { once: true });
    const qrBox = body.querySelector("[data-qr]");
    if (!profileUrl) { qrBox.innerHTML = '<p class="ps-qr-err">Profile link unavailable.</p>'; qrBox.removeAttribute("aria-busy"); return; }
    QRCode.toString(profileUrl, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0d1424", light: "#ffffff" } })
      .then((svg) => {
        if (closed || mode !== "code" || !qrBox.isConnected) return;
        qrBox.innerHTML = svg;
        const s = qrBox.querySelector("svg");
        s?.setAttribute("role", "img");
        s?.setAttribute("aria-label", `QR code linking to @${username}'s Oldtime profile`);
        qrBox.removeAttribute("aria-busy");
      })
      .catch(() => { if (qrBox.isConnected) { qrBox.innerHTML = '<p class="ps-qr-err">Couldn\'t draw the code. Use Copy link instead.</p>'; qrBox.removeAttribute("aria-busy"); } });
  }

  function renderScan() {
    titleEl.textContent = "Scan a profile";
    body.innerHTML = `
      <div class="ps-scan">
        <div class="ps-viewfinder" data-vf>
          <div class="ps-vf-idle">
            ${icon("scan")}
            <p>Point your camera at an Oldtime profile code. Images stay on this device.</p>
          </div>
          <span class="ps-corner tl"></span><span class="ps-corner tr"></span><span class="ps-corner bl"></span><span class="ps-corner br"></span>
        </div>
        <p class="ps-status" role="status" aria-live="polite" data-status></p>
        <div class="ps-actions">
          <button type="button" class="ps-btn ps-btn-primary" data-act="camera">${icon("scan")}<span>Start camera</span></button>
          <button type="button" class="ps-btn ps-btn-ghost" data-act="gallery">${icon("image")}<span>From photos</span></button>
        </div>
      </div>`;
  }

  async function startCamera() {
    const statusEl = body.querySelector("[data-status]");
    const vf = body.querySelector("[data-vf]");
    const camBtn = body.querySelector('[data-act="camera"]');
    if (!statusEl || !vf) return;
    stopCamera();
    const token = ++camToken;
    if (!navigator.mediaDevices?.getUserMedia) {
      statusEl.textContent = "Camera isn't available here. Choose a photo instead.";
      statusEl.dataset.tone = "warn";
      return;
    }
    statusEl.textContent = "Requesting camera…";
    delete statusEl.dataset.tone;
    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    } catch (err) {
      if (closed || token !== camToken) return;
      const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
      statusEl.textContent = denied
        ? "Camera access was blocked. Allow it in your browser settings and retry, or choose a photo."
        : "Couldn't start the camera. Retry, or choose a photo.";
      statusEl.dataset.tone = "warn";
      if (camBtn) camBtn.querySelector("span").textContent = "Retry camera";
      return;
    }
    if (closed || token !== camToken || mode !== "scan") { s.getTracks().forEach((t) => t.stop()); return; }
    stream = s;
    video = el("video", { class: "ps-video", playsinline: true, muted: true, autoplay: true, "aria-hidden": "true" });
    video.muted = true;
    video.srcObject = s;
    vf.classList.add("is-live");
    vf.querySelector(".ps-vf-idle")?.remove();
    vf.prepend(video);
    if (camBtn) { camBtn.querySelector("span").textContent = "Stop camera"; camBtn.dataset.act = "stop"; }
    try { await video.play(); } catch {}
    if (closed || token !== camToken) return;
    statusEl.textContent = "Looking for a code…";
    const tick = async () => {
      if (closed || token !== camToken || !video) return;
      if (video.readyState >= 2 && video.videoWidth) {
        const text = await decode(video, video.videoWidth, video.videoHeight);
        if (closed || token !== camToken) return;
        if (text && (await handleResult(text, statusEl))) return;
      }
      if (!closed && token === camToken) timer = setTimeout(tick, SCAN_INTERVAL_MS);
    };
    timer = setTimeout(tick, SCAN_INTERVAL_MS);
  }

  function resetCameraUi() {
    const vf = body.querySelector("[data-vf]");
    if (!vf) return;
    vf.classList.remove("is-live");
    vf.querySelector("video")?.remove();
    const btn = body.querySelector('[data-act="stop"]');
    if (btn) { btn.dataset.act = "camera"; btn.querySelector("span").textContent = "Start camera"; }
  }

  async function scanFile(file) {
    const statusEl = body.querySelector("[data-status]");
    if (!file || !statusEl) return;
    if (!/^image\//.test(file.type || "")) { statusEl.textContent = "Choose an image file."; statusEl.dataset.tone = "warn"; return; }
    statusEl.textContent = "Reading photo…";
    delete statusEl.dataset.tone;
    let bitmap = null; let objUrl = "";
    try {
      let src, w, h;
      if (typeof createImageBitmap === "function") {
        bitmap = await createImageBitmap(file);
        src = bitmap; w = bitmap.width; h = bitmap.height;
      } else {
        objUrl = URL.createObjectURL(file);
        src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = objUrl; });
        w = src.naturalWidth; h = src.naturalHeight;
      }
      if (closed) return;
      let text = await decode(src, w, h);
      if (!text && Math.max(w, h) > SCAN_MAX_DIM) {
        // retry on centered crop at higher effective resolution
        const side = Math.min(w, h);
        const c = document.createElement("canvas");
        const d = Math.min(side, 1024);
        c.width = d; c.height = d;
        const cx = c.getContext("2d", { willReadFrequently: true });
        cx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, d, d);
        const data = cx.getImageData(0, 0, d, d);
        text = jsQR(data.data, d, d, { inversionAttempts: "attemptBoth" })?.data || "";
        c.width = 1; c.height = 1;
      }
      if (closed) return;
      if (!text) { statusEl.textContent = "No QR code found in that photo."; statusEl.dataset.tone = "warn"; return; }
      await handleResult(text, statusEl);
    } catch {
      if (!closed) { statusEl.textContent = "Couldn't read that photo."; statusEl.dataset.tone = "warn"; }
    } finally {
      bitmap?.close?.();
      if (objUrl) URL.revokeObjectURL(objUrl);
      fileInput.value = "";
    }
  }

  function setMode(next) {
    if (next === mode && body.childElementCount) return;
    stopCamera();
    mode = next;
    for (const t of dialog.querySelectorAll("[data-tab]")) {
      const on = t.dataset.tab === next;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    }
    if (next === "code") renderCode(); else renderScan();
  }

  /* ---------- actions ---------- */
  async function onClick(e) {
    if (e.target === scrim) return close();
    const tab = e.target.closest("[data-tab]");
    if (tab) return setMode(tab.dataset.tab);
    const btn = e.target.closest("[data-act]");
    if (!btn || btn.disabled) return;
    const act = btn.dataset.act;
    if (act === "back") return close();
    if (act === "copy") {
      if (!profileUrl) return notify("Profile link unavailable");
      const ok = await copyText(profileUrl);
      notify(ok ? "Profile link copied" : "Couldn't copy. Press and hold the link to copy it.");
      if (!ok) selectLink();
      return;
    }
    if (act === "share") {
      if (!profileUrl) return notify("Profile link unavailable");
      if (typeof shareExternally !== "function") {
        const ok = await copyText(profileUrl);
        return notify(ok ? "Profile link copied" : "Couldn't share this profile");
      }
      btn.disabled = true;
      try {
        const result = await shareExternally({
          title: `@${username} on Oldtime`,
          text: `Check out @${username} on Oldtime.`,
          url: profileUrl
        });
        if (result === "cancelled") return;
        if (result === "failed") return notify("Couldn't share this profile");
        notify(result === "shared" ? "Profile shared" : "Profile link copied");
      } catch { notify("Couldn't share this profile"); }
      finally { btn.disabled = false; }
      return;
    }
    if (act === "camera") return startCamera();
    if (act === "stop") { stopCamera(); resetCameraUi(); const s = body.querySelector("[data-status]"); if (s) s.textContent = "Camera stopped."; return; }
    if (act === "gallery") { stopCamera(); resetCameraUi(); fileInput.click(); }
  }

  function selectLink() {
    const p = body.querySelector(".ps-link");
    if (!p) return;
    const r = document.createRange(); r.selectNodeContents(p);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }

  function focusables() {
    return [...dialog.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
      .filter((n) => n.offsetParent !== null || n === document.activeElement);
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); return close(); }
    if (e.key === "Tab") {
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && e.target.closest?.("[data-tab]")) {
      const next = mode === "code" ? "scan" : "code";
      setMode(next);
      dialog.querySelector(`[data-tab="${next}"]`)?.focus();
    }
  }
  function onVisibility() { if (document.hidden && stream) { stopCamera(); resetCameraUi(); const s = body.querySelector("[data-status]"); if (s) s.textContent = "Camera paused."; } }
  function onPop() { close(); }

  function close() {
    if (closed) return;
    closed = true;
    stopCamera();
    wipe();
    root.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("popstate", onPop);
    fileInput.value = "";
    root.classList.add("is-closing");
    const done = () => { root.remove(); document.body.style.overflow = prevOverflow; };
    const reduce = matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) done(); else setTimeout(done, 160);
    if (opener && typeof opener.focus === "function" && opener.isConnected) opener.focus();
  }

  fileInput.addEventListener("change", () => scanFile(fileInput.files?.[0]));
  root.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("popstate", onPop);

  if ("BarcodeDetector" in window) {
    Promise.resolve(window.BarcodeDetector.getSupportedFormats?.() ?? ["qr_code"])
      .then((f) => { if (f.includes("qr_code") && !closed) detector = new window.BarcodeDetector({ formats: ["qr_code"] }); })
      .catch(() => {});
  }

  document.body.style.overflow = "hidden";
  document.body.append(root);
  setMode("code");
  requestAnimationFrame(() => { if (!closed) dialog.querySelector('[data-tab="code"]')?.focus(); });

  close.isBusy = () => busy;
  return close;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const escapeAttr = escapeHtml;
