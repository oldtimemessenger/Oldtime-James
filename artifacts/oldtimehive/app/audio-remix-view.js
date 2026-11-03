import { I } from "./creative-view-icons.js";

const fallbackEsc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function safeUrl(url) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (/^(https?:|blob:)/i.test(u) || /^data:image\//i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith("//")) return "";
  return u;
}

function avatar(url, name, e, cls = "") {
  const s = safeUrl(url);
  return s
    ? `<img class="ap-avatar ${cls}" src="${e(s)}" alt="" loading="lazy">`
    : `<span class="ap-avatar ap-initial ${cls}" aria-hidden="true">${e(String(name || "?").trim().charAt(0).toUpperCase())}</span>`;
}

export function renderAudioPanel({ post = {}, author = {}, saved = false, library = [], uses = 0, esc = fallbackEsc, icons = {} } = {}) {
  const e = esc || fallbackEsc;
  const title = post.soundTitle || post.sound?.title || post.audioTitle || "Original audio";
  const who = post.soundAuthor || post.sound?.author || author.username || author.name || "";
  const av = post.soundAvatar || post.sound?.avatar || author.avatar;
  const n = Number(uses) || 0;
  const isVideo = post.kind === "video";
  const rows = (library || []).map(l => {
    const id = e(l.id);
    return `<li class="ap-row">
      <div class="ap-row-main" role="button" tabindex="0" data-audio-library="${id}" aria-label="Use ${e(l.title)}">
        ${avatar(l.avatar, l.author || l.title, e)}
        <span class="ap-text"><b>${e(l.title)}</b><small>${e(l.author)}</small></span>
        <button type="button" class="ap-mini" data-audio-remove="${id}" aria-label="Remove ${e(l.title)} from library">${icons.close || "Remove"}</button>
      </div>
    </li>`;
  }).join("");
  return `<section class="panel audio-panel" role="dialog" aria-modal="true" aria-labelledby="ap-title" data-post-id="${e(post.id ?? "")}">
    <div class="ap-grab" aria-hidden="true"></div>
    <header class="ap-head">
      ${avatar(av, who || title, e, "ap-lg")}
      <span class="ap-text"><b id="ap-title">${e(title)}</b><small>${e(who)}</small></span>
      <button type="button" class="ap-close" data-audio-close aria-label="Close">${icons.close || "Close"}</button>
    </header>
    <div class="ap-body">
      <p class="ap-uses"><b>${e(n.toLocaleString())}</b> ${n === 1 ? "post uses" : "posts use"} this sound</p>
      <audio id="ap-preview" controls preload="none"></audio>
      <div class="ap-actions">
        <button type="button" class="ap-primary" data-audio-reuse>Use this sound</button>
        <button type="button" class="ap-ghost" data-audio-remix${isVideo ? "" : " disabled"}>Remix</button>
        <button type="button" class="ap-ghost${saved ? " on" : ""}" data-audio-save aria-pressed="${!!saved}">${saved ? (icons.mediaBookmarkOn || icons.bookmarkOn || "") : (icons.mediaBookmark || icons.bookmark || "")}<span>${saved ? "Saved" : "Save"}</span></button>
      </div>
      ${isVideo ? "" : `<p class="ap-note">Remix is available for video posts.</p>`}
      ${rows ? `<h2 class="ap-sec">Saved sounds</h2><ul class="ap-list">${rows}</ul>` : ""}
      <p class="ap-error" data-audio-error role="alert"></p>
    </div>
  </section>`;
}

const opts = (list, e) => list.map(([v, t]) => `<option value="${e(v)}">${e(t)}</option>`).join("");
const range = (id, label, min, max, val, e, step = 1) =>
  `<label class="rs-field" for="${id}"><span>${e(label)}</span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
const select = (id, label, list, e) =>
  `<label class="rs-field" for="${id}"><span>${e(label)}</span><select id="${id}">${opts(list, e)}</select></label>`;

export function renderRemixStudio({ post = {}, mode = "remix", esc = fallbackEsc, icons = {} } = {}) {
  const e = esc || fallbackEsc;
  const reuse = mode === "reuse";
  const layouts = [["overlay", "Overlay"], ["cutout", "Cutout"], ["floating", "Floating"], ["split", "Split"], ["background", "Background"], ["pip", "Picture in picture"], ["react", "React · Behind Me"], ["freeform", "Freeform"]];
  if (reuse) layouts.unshift(["solo", "Solo"]);
  const snaps = [["free", "Free"], ["top-left", "Top left"], ["top", "Top"], ["top-right", "Top right"], ["left", "Left"], ["center", "Center"], ["right", "Right"], ["bottom-left", "Bottom left"], ["bottom", "Bottom"], ["bottom-right", "Bottom right"]];
  const tools = [["layout", "Layout", I.frames], ["style", "Settings", I.sliders], ["audio", "Audio", I.music], ["post", "Post", I.share]];
  return `<section class="remix-studio remix-overlay rs-panel-collapsed" role="dialog" aria-modal="true" aria-labelledby="rs-title" data-post-id="${e(post.id ?? "")}" data-mode="${e(mode)}">
    <header class="rs-head">
      <button type="button" class="rs-close" data-studio-back aria-label="Back to original post">${I.arrowNext.replace("<path", "<path transform=\"rotate(180 12 12)\"")}</button>
      <b id="rs-title">${reuse ? "Use sound" : "Remix"}</b>
      <span id="studio-history-slot" class="rs-history-slot"></span>
      <button type="button" id="studio-fullscreen" class="rs-close rs-fs" aria-pressed="false" aria-label="Full-screen editing">${I.fullscreen}</button>
      <button type="button" class="rs-close" data-studio-close aria-label="Close studio">${I.close}</button>
    </header>
    <div class="rs-workspace">
      <div class="rs-preview">
        <div class="rs-stage"><canvas id="remix-canvas" width="540" height="960"></canvas>
          <video id="studio-result" class="rs-result" controls playsinline hidden></video>
          <div id="studio-selection" class="rs-selection" hidden>
            <button type="button" class="rs-handle rs-h-nw" data-studio-handle="nw" aria-label="Resize from top left"></button>
            <button type="button" class="rs-handle rs-h-ne" data-studio-handle="ne" aria-label="Resize from top right"></button>
            <button type="button" class="rs-handle rs-h-sw" data-studio-handle="sw" aria-label="Resize from bottom left"></button>
            <button type="button" class="rs-handle rs-h-se" data-studio-handle="se" aria-label="Resize from bottom right"></button>
            <button type="button" class="rs-handle rs-h-rotate" data-studio-handle="rotate" aria-label="Rotate"></button>
          </div>
          <div id="studio-text-editor" class="rs-text-editor" contenteditable="plaintext-only" role="textbox" aria-label="Edit text" spellcheck="false" hidden></div>
        </div>
        <div class="rs-messages">
          <p id="studio-status" class="rs-status" role="status"></p>
          <p id="studio-error" class="rs-error" role="alert"></p>
          <button type="button" id="studio-retry-cutout" class="rs-chip rs-retry" hidden>Retry cutout</button>
        </div>
      </div>
      <div class="rs-controls">
        <div class="rs-layers" role="group" aria-label="Layer to edit">${[["original","Original"],["me","Me"],["text","Text"],["sticker","Sticker"],["drawing","Drawing"]].map(([k, l], i) => `<button type="button" class="rs-layer${i ? "" : " on"}" data-studio-select="${k}" aria-pressed="${i ? "false" : "true"}">${l}</button>`).join("")}</div>
        <div class="rs-panels" id="studio-panels">
          <fieldset class="rs-group" data-studio-panel="layout"><legend>Layout</legend>
            ${select("studio-layout", "Layout", layouts, e)}
            ${select("studio-layer", "Edit layer", [["original", "Original"], ["me", "Me"]], e)}
            ${range("studio-divider", "Divider", 20, 80, 50, e)}
            ${range("studio-x", "Position X", 0, 100, 50, e)}
            ${range("studio-y", "Position Y", 0, 100, 50, e)}
            ${range("studio-size", "Size", 15, 100, 50, e)}
            ${range("studio-rotation", "Rotation", -30, 30, 0, e)}
            ${select("studio-snap", "Snap", snaps, e)}
          </fieldset>
          <fieldset class="rs-group" data-studio-panel="style" hidden><legend>Style</legend>
            ${select("studio-shape", "Shape", [["rounded", "Rounded"], ["rectangle", "Rectangle"], ["circle", "Circle"], ["card", "Card"]], e)}
            ${select("studio-border", "Border", [["none", "None"], ["thin", "Thin"], ["glow", "Glow"], ["frame", "Frame"]], e)}
            <label class="rs-check" for="studio-cutout"><input id="studio-cutout" type="checkbox"><span>Remove background automatically</span></label>
            ${range("studio-crop", "Crop", 1, 2, 1, e, 0.05)}
            ${select("studio-effect", "Effect", [["none", "None"], ["mono", "Mono"], ["warm", "Warm"]], e)}
            <label class="rs-field" for="studio-text"><span>Text</span><input id="studio-text" type="text" maxlength="80" autocomplete="off" placeholder="Add text"></label>
            ${select("studio-sticker", "Sticker", [["none", "None"], ["heart", "Heart"], ["laugh", "Laugh"], ["thumbs-up", "Thumbs up"], ["food", "Food"]], e)}
          </fieldset>
          <fieldset class="rs-group" data-studio-panel="audio" hidden><legend>Audio</legend>
            ${range("studio-original-volume", "Original volume", 0, 100, 80, e)}
            ${range("studio-me-volume", "My volume", 0, 100, 80, e)}
            ${range("studio-offset", "Sync offset (s)", 0, 30, 0, e, 0.1)}
          </fieldset>
          <fieldset class="rs-group" data-studio-panel="post" hidden><legend>Post</legend>
            <label class="rs-field" for="studio-caption"><span>Caption</span><textarea id="studio-caption" maxlength="1000" rows="3" placeholder="Write a caption"></textarea></label>
            ${select("studio-visibility", "Who can see this", [["public", "Public"], ["followers", "Followers"], ["friends", "Friends"], ["close-friends", "Close Friends"], ["only-me", "Only me"]], e)}
          </fieldset>
        </div>
        <div class="rs-toolbar">
          <div class="rs-dock" aria-label="Edit tools">
            <div id="studio-source" class="rs-source">
              <input id="studio-file" type="file" accept="image/*,video/*" hidden>
              <button type="button" id="studio-upload" class="rs-dock-btn" aria-label="Choose media to upload">${I.upload}<span>Upload</span></button>
              <button type="button" id="studio-camera" class="rs-dock-btn" aria-label="Open camera options">${I.camera}<span>Camera</span></button>
            </div>
            <button type="button" class="rs-tab rs-dock-btn" data-studio-tool="layout" aria-pressed="false">${I.frames}<span>Layout</span></button><button type="button" class="rs-dock-btn rs-act" data-studio-select="text" aria-label="Add text layer">${I.text}<span>Text</span></button><button type="button" class="rs-dock-btn rs-act" data-studio-select="sticker" aria-label="Add sticker layer">${I.sticker}<span>Sticker</span></button><button type="button" class="rs-dock-btn rs-act" data-studio-select="drawing" aria-label="Draw on video">${I.draw}<span>Drawing</span></button><button type="button" class="rs-tab rs-dock-btn" data-studio-tool="style" aria-pressed="false">${I.sliders}<span>Settings</span></button><button type="button" class="rs-tab rs-dock-btn" data-studio-tool="audio" aria-pressed="false">${I.music}<span>Audio</span></button><button type="button" class="rs-tab rs-dock-btn" data-studio-tool="post" aria-pressed="false">${I.share}<span>Post</span></button>
          </div>
          <button type="button" id="studio-panel-toggle" class="rs-panel-toggle" aria-expanded="false" aria-controls="studio-panels" aria-label="Show or hide adjustments">${I.chev}</button>
        </div>
      </div>
    </div>
    <footer class="rs-actions">
      <button type="button" id="studio-retake" class="rs-ghost" hidden>${I.undo}<span>Retake</span></button>
      <button type="button" id="studio-record" class="rs-record">${I.camera}<span>Record</span></button>
      <button type="button" id="studio-stop" class="rs-ghost" disabled>${I.check}<span>Stop</span></button>
      <button type="button" id="studio-next" class="rs-ghost">${I.arrowNext}<span>Next</span></button>
      <button type="button" id="studio-publish" class="rs-publish" disabled>${I.share}<span>Publish</span></button>
    </footer>
    <section id="studio-media-picker" class="rs-picker" role="dialog" aria-modal="true" aria-labelledby="studio-picker-title" hidden>
      <div class="rs-picker-card">
        <header class="rs-picker-head"><b id="studio-picker-title">Add media</b><button type="button" data-picker-close aria-label="Close media picker">${I.close}</button></header>
        <div class="rs-picker-actions">
          <button type="button" id="studio-picker-photo">${I.camera}<span>Take photo</span></button>
          <button type="button" id="studio-picker-video">${I.video}<span>Record video</span></button>
          <button type="button" id="studio-picker-library">${I.gallery}<span>Choose from library</span></button>
          <button type="button" id="studio-picker-preview">${I.eye}<span>Live camera preview</span></button>
        </div>
        <video id="studio-picker-preview-video" playsinline muted hidden aria-label="Live camera preview"></video>
        <button type="button" id="studio-picker-capture" class="rs-publish" hidden>Capture photo</button>
        <p id="studio-picker-status" role="status"></p>
      </div>
    </section>
  </section>`;
}
