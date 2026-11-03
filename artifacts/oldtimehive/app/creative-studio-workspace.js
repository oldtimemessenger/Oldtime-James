// Oldtime Create workspace: preview on top, real multi-lane timeline, bottom tool categories
// that open explicit bottom sheets. All actions delegate to the existing engine controls so
// every earlier tool (draw, layers, cutouts, text styles, pages, sounds…) keeps its behaviour.
import { svg, I } from "./creative-view-icons.js";
import { clamp } from "./creative-project.js";
import { clipDuration } from "./creative-video-edit.js";
import { ADJUSTMENTS, FILTER_PRESETS, readLook, readGeometry, setAdjust, resetAdjust, resetAllAdjust, setPreset, syncLookMarker, applyLookPixels, drawBackgroundSource } from "./creative-look.js";

const ICON = {
  edit: I.scissors,
  audio: I.music,
  text: svg('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
  overlay: svg('<rect x="3" y="7" width="12" height="12" rx="2.5"/><rect x="9" y="3" width="12" height="12" rx="2.5"/>'),
  filters: svg('<circle cx="9" cy="9" r="5"/><circle cx="15" cy="9" r="5"/><circle cx="12" cy="15" r="5"/>'),
  adjust: I.sliders,
  canvas: svg('<path d="M6 2v14a2 2 0 002 2h14"/><path d="M18 22V8a2 2 0 00-2-2H2"/>'),
  reset: svg('<path d="M4 12a8 8 0 108-8H8"/><path d="M8 1 5 4l3 3"/>'),
  rotate: svg('<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  compare: svg('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M12 4v16"/>'),
  close: I.close, play: I.play, undo: I.undo, redo: I.redo,
};
export const STUDIO_TOOLS = [["edit", "Edit"], ["audio", "Audio"], ["text", "Text"], ["overlay", "Overlay"], ["filters", "Filters"], ["adjust", "Adjust"], ["canvas", "Canvas"]];
const LANES = [["media", "Video"], ["text", "Text"], ["overlay", "Overlay"], ["audio", "Audio"]];

export function renderStudioWorkspace() {
  return `<button type="button" id="ce-compare" class="cs-compare cs-ws-only" aria-label="Hold to compare with the original" hidden>${ICON.compare}<span>Hold to compare</span></button>
  <section class="cs-ws cs-ws-only" aria-label="Editing workspace">
    <div class="cs-ws-bar">
      <button type="button" id="ce-ws-play" class="cs-ws-icon" aria-label="Play">${ICON.play}</button>
      <span id="ce-ws-time" class="cs-ws-time" aria-live="off">0.0 / 0.0s</span>
      <span class="cs-ws-spacer"></span>
      <button type="button" id="ce-ws-undo" class="cs-ws-icon" aria-label="Undo">${ICON.undo}</button>
      <button type="button" id="ce-ws-redo" class="cs-ws-icon" aria-label="Redo">${ICON.redo}</button>
    </div>
    <div class="cs-tl" id="ce-tl">
      <div class="cs-tl-labels" aria-hidden="true"><span></span>${LANES.map(([k, l]) => `<span data-lane-label="${k}">${l}</span>`).join("")}</div>
      <div class="cs-tl-track" id="ce-tl-track" role="slider" tabindex="0" aria-label="Timeline playhead" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">
        <div class="cs-tl-ruler" id="ce-tl-ruler"></div>
        ${LANES.map(([k, l]) => `<div class="cs-tl-lane" data-lane="${k}" role="list" aria-label="${l} lane"></div>`).join("")}
        <div class="cs-tl-head" id="ce-tl-head" aria-hidden="true"></div>
      </div>
    </div>
    <nav class="cs-tools" role="toolbar" aria-label="Editing tools">
      ${STUDIO_TOOLS.map(([k, l]) => `<button type="button" class="cs-tool" data-cs-tool="${k}" aria-expanded="false" aria-controls="ce-ws-sheet">${ICON[k]}<span>${l}</span></button>`).join("")}
    </nav>
    <div hidden>
      <button type="button" data-ce-add="emoji" tabindex="-1">Emoji</button>
      <button type="button" data-ce-add="comment" tabindex="-1">Comment</button>
    </div>
  </section>
  <section id="ce-ws-sheet" class="cs-sheet" role="dialog" aria-labelledby="ce-ws-sheet-title" hidden>
    <header class="cs-sheet-head"><b id="ce-ws-sheet-title">Edit</b><button type="button" id="ce-ws-sheet-close" class="cs-ws-icon" aria-label="Close tool sheet">${ICON.close}</button></header>
    <div id="ce-ws-sheet-body" class="cs-sheet-body"></div>
  </section>`;
}

/* ---------- pure timeline model (tested) ---------- */
const OVERLAY_KINDS = new Set(["image", "sticker", "emoji", "drawing"]);
export function timelineLanes(project) {
  const duration = Math.max(.1, project.duration || .1), bg = project.background || {};
  const media = [];
  if (bg.kind === "video" && bg.media && bg.media !== "live-camera") {
    let offset = 0;
    const clips = bg.videoEdit?.clips?.length ? bg.videoEdit.clips : [{ id: "original", in: 0, out: duration, speed: 1 }];
    clips.forEach((clip, index) => { const length = clipDuration(clip); media.push({ id: clip.id, kind: "clip", index, start: offset, end: offset + length, label: `Clip ${index + 1}` }); offset += length; });
  } else if (bg.media && bg.media !== "live-camera") media.push({ id: "background", kind: "photo", start: 0, end: duration, label: "Photo" });
  else media.push({ id: "background", kind: "canvas", start: 0, end: duration, label: "Canvas" });
  const layerItem = layer => ({ id: layer.id, kind: layer.kind, layer: true, start: clamp(layer.startTime ?? 0, 0, duration), end: clamp(layer.endTime ?? duration, 0, duration), locked: !!layer.locked, hidden: !!layer.hidden,
    label: layer.kind === "text" ? (layer.text || "Text").slice(0, 28) : layer.kind === "comment" ? "Comment" : layer.kind === "image" ? (layer.subjectCutout ? "Cutout" : "Photo overlay") : layer.kind === "drawing" ? "Drawing" : layer.kind === "emoji" ? "Emoji" : "Sticker" });
  const visible = (project.layers || []).filter(l => !(l.subjectCutout && l.subjectForTextId));
  const audio = (project.audioTracks || []).map((track, index) => ({ id: track.id || `track-${index}`, kind: "sound", start: 0, end: duration, label: track.title || "Sound" }));
  if (bg.kind === "video" && bg.media && bg.media !== "live-camera") audio.push({ id: "original-audio", kind: "original", start: 0, end: duration, muted: bg.audioMuted === true, label: bg.audioMuted === true ? "Original audio · muted" : "Original audio" });
  return {
    duration, media,
    text: visible.filter(l => l.kind === "text" || l.kind === "comment").map(layerItem),
    overlay: visible.filter(l => OVERLAY_KINDS.has(l.kind)).map(layerItem),
    audio,
  };
}
export const MIN_LAYER_SECONDS = .1;
export function trimLayerTiming(layer, edge, value, duration) {
  if (edge === "start") layer.startTime = clamp(value, 0, Math.max(0, layer.endTime - MIN_LAYER_SECONDS));
  else layer.endTime = clamp(value, layer.startTime + MIN_LAYER_SECONDS, duration);
  return layer;
}
export function moveLayerTiming(layer, start, duration) {
  const length = Math.min(duration, layer.endTime - layer.startTime);
  layer.startTime = clamp(start, 0, Math.max(0, duration - length)); layer.endTime = layer.startTime + length;
  return layer;
}
export const timeAtFraction = (fraction, duration) => clamp(fraction, 0, 1) * duration;

/* ---------- binding ---------- */
export function bindStudioWorkspace({ root, editor, q, project, assets, history, changed, seek, time, select, selectedId, stop, canEdit, rail, onCompare }) {
  const sheet = q("ws-sheet"), body = q("ws-sheet-body"), track = q("tl-track"), head = q("tl-head");
  let open = null, signature = "", thumbs = { key: "", urls: new Map() }, disposed = false, comparing = false;
  const fire = (el, type) => el?.dispatchEvent(new Event(type, { bubbles: true }));
  const el = id => q(id);

  /* timeline rendering */
  const pos = (node, item, duration) => { node.style.left = `${item.start / duration * 100}%`; node.style.width = `${Math.max(.6, (item.end - item.start) / duration * 100)}%`; };
  const refreshTimeline = () => {
    const model = timelineLanes(project), sel = selectedId();
    const sig = JSON.stringify([model.duration, ...["media", "text", "overlay", "audio"].map(k => model[k].map(i => [i.id, i.label, i.locked, i.hidden, i.muted]))]);
    if (sig !== signature) {
      signature = sig;
      const ruler = q("tl-ruler"); ruler.replaceChildren();
      const step = model.duration > 30 ? 5 : model.duration > 10 ? 2 : model.duration > 4 ? 1 : .5;
      for (let t = 0; t <= model.duration + 1e-6; t += step) { const tick = document.createElement("span"); tick.style.left = `${t / model.duration * 100}%`; tick.textContent = `${Number.isInteger(t) ? t : t.toFixed(1)}s`; ruler.append(tick); }
      for (const [lane] of LANES) {
        const host = root.querySelector(`[data-lane="${lane}"]`); host.replaceChildren();
        if (!model[lane].length) { const empty = document.createElement("span"); empty.className = "cs-tl-empty"; empty.textContent = lane === "audio" ? "No sound" : lane === "text" ? "No text" : "Nothing yet"; host.append(empty); }
        for (const item of model[lane]) {
          const node = document.createElement("div"); node.className = `cs-tl-block is-${lane}`; node.dataset.id = item.id; node.dataset.lane = lane; node.setAttribute("role", "listitem");
          node.tabIndex = 0; node.setAttribute("aria-label", `${item.label}, ${item.start.toFixed(1)} to ${item.end.toFixed(1)} seconds`);
          node.innerHTML = `<span class="cs-tl-name"></span>`; node.firstChild.textContent = item.label;
          if (item.layer && !item.locked) node.insertAdjacentHTML("beforeend", `<span class="cs-tl-grip is-start" data-edge="start" aria-hidden="true"></span><span class="cs-tl-grip is-end" data-edge="end" aria-hidden="true"></span>`);
          if (item.muted) node.classList.add("is-muted"); if (item.hidden) node.classList.add("is-hidden-layer"); if (item.locked) node.classList.add("is-locked");
          host.append(node);
        }
      }
      paintFilmstrip();
    }
    for (const [lane] of LANES) for (const item of model[lane]) {
      const node = root.querySelector(`.cs-tl-block[data-lane="${lane}"][data-id="${CSS.escape(item.id)}"]`);
      if (node) { pos(node, item, model.duration); node.classList.toggle("is-selected", item.id === sel); node.setAttribute("aria-label", `${item.label}, ${item.start.toFixed(1)} to ${item.end.toFixed(1)} seconds`); }
    }
    tick(time());
  };
  const paintFilmstrip = () => {
    const strip = q("filmstrip"), block = root.querySelector('.cs-tl-block[data-lane="media"]');
    if (!block) return;
    const media = root.querySelectorAll('.cs-tl-block[data-lane="media"]');
    if (strip?.children.length) media.forEach(node => { node.style.backgroundImage = [...strip.querySelectorAll("img")].slice(0, 1).map(img => `url(${img.src})`).join(","); });
    else if (project.background.kind === "photo") { const image = assets.get(project.background.media); if (image?.src) media.forEach(node => node.style.backgroundImage = `url(${image.src})`); }
  };
  const tick = at => {
    const duration = Math.max(.1, project.duration), w = track.clientWidth;
    head.style.transform = `translateX(${(at / duration) * w}px)`;
    track.setAttribute("aria-valuemax", duration.toFixed(1)); track.setAttribute("aria-valuenow", at.toFixed(1)); track.setAttribute("aria-valuetext", `${at.toFixed(1)} seconds`);
    q("ws-time").textContent = `${at.toFixed(1)} / ${duration.toFixed(1)}s`;
  };

  /* timeline interaction: scrub, select, move, trim */
  let drag = null;
  const secondsPerPx = () => project.duration / Math.max(1, track.clientWidth);
  track.addEventListener("pointerdown", event => {
    if (!canEdit()) return;
    const block = event.target.closest(".cs-tl-block"), rect = track.getBoundingClientRect();
    if (block) {
      const lane = block.dataset.lane, id = block.dataset.id, layer = project.layers.find(l => l.id === id);
      if (layer) {
        select(id);
        if (!layer.locked) {
          history.record(); stop();
          drag = { kind: event.target.dataset.edge || "move", layer, x: event.clientX, start: layer.startTime, end: layer.endTime, pointer: event.pointerId, node: block };
          track.setPointerCapture(event.pointerId);
        }
        event.preventDefault(); return;
      }
      if (lane === "media") { const clip = project.background.videoEdit?.clips?.findIndex(c => c.id === id); if (clip >= 0) root.querySelector(`#ce-clip-list [data-clip-index="${clip}"]`)?.click(); openSheet("edit"); return; }
      if (lane === "audio") { openSheet("audio"); return; }
    }
    drag = { kind: "scrub", pointer: event.pointerId };
    track.setPointerCapture(event.pointerId);
    seek(timeAtFraction((event.clientX - rect.left) / rect.width, project.duration));
  });
  track.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (drag.kind === "scrub") { const rect = track.getBoundingClientRect(); seek(timeAtFraction((event.clientX - rect.left) / rect.width, project.duration)); return; }
    const delta = (event.clientX - drag.x) * secondsPerPx(), layer = drag.layer;
    if (drag.kind === "move") moveLayerTiming(layer, drag.start + delta, project.duration);
    else trimLayerTiming(layer, drag.kind, (drag.kind === "start" ? drag.start : drag.end) + delta, project.duration);
    seek(drag.kind === "end" ? Math.max(layer.startTime, layer.endTime - .02) : layer.startTime);
    changed();
  });
  const endDrag = () => { drag = null; };
  track.addEventListener("pointerup", endDrag); track.addEventListener("pointercancel", endDrag);
  track.addEventListener("keydown", event => {
    const step = event.shiftKey ? 1 : .1;
    if (event.key === "ArrowRight") { event.preventDefault(); seek(Math.min(project.duration, time() + step)); }
    if (event.key === "ArrowLeft") { event.preventDefault(); seek(Math.max(0, time() - step)); }
    if (event.key === "Home") { event.preventDefault(); seek(0); }
    if (event.key === "End") { event.preventDefault(); seek(project.duration); }
    const block = event.target.closest?.(".cs-tl-block");
    if (block && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); const layer = project.layers.find(l => l.id === block.dataset.id); if (layer) { select(layer.id); seek(layer.startTime); } else openSheet(block.dataset.lane === "audio" ? "audio" : "edit"); }
  });

  /* bar */
  q("ws-play").onclick = () => q("play").click();
  q("ws-undo").onclick = () => q("undo").click();
  q("ws-redo").onclick = () => q("redo").click();

  /* compare: bypasses the look only while held, never mutates the project */
  const compare = q("compare");
  const setCompare = value => { if (comparing === value) return; comparing = value; compare.setAttribute("aria-pressed", String(value)); editor.classList.toggle("is-comparing", value); onCompare(value); };
  compare.addEventListener("pointerdown", event => { event.preventDefault(); compare.setPointerCapture?.(event.pointerId); setCompare(true); });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture", "blur"]) compare.addEventListener(type, () => setCompare(false));
  compare.addEventListener("keydown", event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); setCompare(true); } });
  compare.addEventListener("keyup", () => setCompare(false));

  /* sheet plumbing */
  const titles = Object.fromEntries(STUDIO_TOOLS);
  const delegate = (label, icon, target, { closeFirst = true, hidden } = {}) => ({ label, icon, target, closeFirst, hidden });
  const actionGrid = actions => {
    const grid = document.createElement("div"); grid.className = "cs-actions";
    for (const action of actions) {
      const button = document.createElement("button"); button.type = "button"; button.className = "cs-action";
      button.innerHTML = `${action.icon || ""}<span></span>`; button.lastChild.textContent = action.label;
      const target = typeof action.target === "function" ? null : action.target;
      const resolve = () => typeof action.target === "function" ? action.target : () => { const node = typeof target === "string" ? root.querySelector(target) : target; node?.click(); };
      const node = typeof target === "string" ? root.querySelector(target) : target;
      button.disabled = !canEdit() || (node ? node.disabled || (action.hidden ?? false) : typeof action.target !== "function") || action.disabled === true;
      button.onclick = () => { if (action.closeFirst) closeSheet(false); resolve()(); };
      grid.append(button);
    }
    return grid;
  };
  const sliderRow = ({ id, label, min, max, step = 1, value, format = v => String(Math.round(v)), onStart, onInput, onReset }) => {
    const row = document.createElement("div"); row.className = "cs-slider";
    row.innerHTML = `<label for="${id}"></label><output for="${id}"></output><button type="button" class="cs-reset" aria-label="Reset ${label}">${ICON.reset}</button><input id="${id}" type="range" min="${min}" max="${max}" step="${step}">`;
    const [lab, out, reset, input] = row.children;
    lab.textContent = label; input.value = String(value); out.textContent = format(Number(value));
    const fill = () => { const p = (Number(input.value) - min) / (max - min) * 100, z = (0 - min) / (max - min) * 100; input.style.setProperty("--a", `${Math.min(p, Math.max(0, z))}%`); input.style.setProperty("--b", `${Math.max(p, Math.max(0, z))}%`); reset.disabled = Number(input.value) === (min < 0 ? 0 : min === 0 ? 0 : Number(value)); };
    input.setAttribute("aria-valuetext", format(Number(value)));
    input.addEventListener("pointerdown", () => onStart?.()); input.addEventListener("keydown", () => onStart?.());
    input.oninput = () => { onInput(Number(input.value)); out.textContent = format(Number(input.value)); input.setAttribute("aria-valuetext", out.textContent); fill(); };
    reset.onclick = () => { onReset(); };
    fill(); return row;
  };
  const segmented = (label, options, current, onPick) => {
    const group = document.createElement("div"); group.className = "cs-seg"; group.setAttribute("role", "radiogroup"); group.setAttribute("aria-label", label);
    for (const [value, text] of options) {
      const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(value === current)); b.textContent = text;
      b.onclick = () => { onPick(value); }; group.append(b);
    }
    return group;
  };
  const section = (title, ...nodes) => { const s = document.createElement("section"); s.className = "cs-sheet-section"; if (title) { const h = document.createElement("h3"); h.textContent = title; s.append(h); } s.append(...nodes.filter(Boolean)); return s; };
  const note = text => { const p = document.createElement("p"); p.className = "cs-sheet-note"; p.textContent = text; return p; };
  const bg = () => project.background;
  const hasMedia = () => !!bg().media && bg().media !== "live-camera";
  const afterLook = () => { syncLookMarker(bg()); changed(false); };

  const builders = {
    edit() {
      const isVideo = bg().kind === "video" && hasMedia(), sel = project.layers.find(l => l.id === selectedId());
      return [
        isVideo && section("Clip", actionGrid([delegate("Trim", I.scissors, '[data-ce-media-tool="trim"]'), delegate("Split", I.split, "[data-ce-quick-split]"), delegate("Speed", I.speed, '[data-ce-media-tool="speed"]')])),
        section("Selected layer", sel ? null : note("Tap a layer on the preview or timeline to edit it."), actionGrid([
          delegate("Options", I.sliders, "#ce-style-toggle", { disabled: !sel }), delegate("Duplicate", I.frames, "#ce-duplicate", { closeFirst: false }), delegate("Delete", I.trash, "#ce-delete", { closeFirst: false }),
          delegate("Forward", svg('<path d="M12 19V5M5 12l7-7 7 7"/>'), "#ce-forward", { closeFirst: false }), delegate("Backward", svg('<path d="M12 5v14M19 12l-7 7-7-7"/>'), "#ce-backward", { closeFirst: false }),
          delegate(sel?.locked ? "Unlock" : "Lock", svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>'), "#ce-lock", { closeFirst: false }),
          delegate(sel?.hidden ? "Show" : "Hide", I.eye, "#ce-hide", { closeFirst: false }),
        ].map(a => ({ ...a, disabled: a.disabled || !sel })))),
        section("Subject", actionGrid([delegate("Remove background", I.removeBg, '[data-ce-rail="remove-bg"]'), delegate("Refine edges", I.draw, "#ce-refine-mask", { hidden: el("refine-mask")?.hidden }), delegate("Text behind subject", I.layers, "#ce-behind-subject", { hidden: el("behind-subject")?.hidden })])),
        section("Project", actionGrid([delegate("Layers", I.layers, "#ce-layers-toggle"), delegate("Preview", I.eye, "#ce-preview"), delegate("Download", I.download, "#ce-export"), ...(el("save-exit") ? [delegate("Save & exit", I.check, "#ce-save-exit")] : [])])),
      ];
    },
    audio() {
      const track0 = project.audioTracks?.[0], isVideo = bg().kind === "video" && hasMedia(), nodes = [];
      nodes.push(section("Sound", track0 ? note(`Using “${track0.title || "Sound"}”. Sounds are optional.`) : note("Photos and videos can stay silent. Add a sound only if you want one."),
        actionGrid([delegate(track0 ? "Change sound" : "Add sound", I.music, "#ce-sound-chip"), delegate("Preview", I.play, "#ce-sound-preview-toggle", { closeFirst: false, hidden: !track0 }), delegate("Remove", I.trash, "#ce-sound-remove", { closeFirst: false, hidden: !track0 })])));
      if (track0) nodes.push(section(null, sliderRow({ id: "ce-ws-volume", label: "Sound volume", min: 0, max: 100, value: Math.round((track0.volume ?? .8) * 100), format: v => `${Math.round(v)}%`,
        onStart: () => history.record(), onInput: v => { const input = el("sound-volume"); input.value = String(v / 100); fire(input, "input"); }, onReset: () => { history.record(); const input = el("sound-volume"); input.value = ".8"; fire(input, "input"); rebuild(); } })));
      if (isVideo) {
        const toggle = el("original-audio-toggle"), muted = bg().audioMuted === true;
        nodes.push(section("Original audio", segmented("Original video audio", [["on", "On"], ["off", "Muted"]], muted ? "off" : "on", value => { if (!toggle) return; toggle.checked = value === "off"; fire(toggle, "change"); rebuild(); })));
      }
      return nodes;
    },
    text() {
      const sel = project.layers.find(l => l.id === selectedId() && l.kind === "text");
      return [section("Text", actionGrid([delegate("Add text", ICON.text, '[data-ce-rail="text"]'), delegate("Styles", I.frames, '[data-ce-rail="templates"]'), delegate("Edit style", I.sliders, "#ce-style-toggle", { disabled: !sel })])),
        note("Double-tap text on the preview to retype it. Drag its timeline bar to set when it appears.")];
    },
    overlay() {
      return [section("Overlay", actionGrid([delegate("Photo / GIF", I.image, '[data-ce-rail="overlay"]'), delegate("Emoji", I.emoji, '[data-ce-add="emoji"]'), delegate("Draw", I.draw, '[data-ce-rail="draw"]'), delegate("Comment card", I.caption, '[data-ce-add="comment"]')]))];
    },
    filters() {
      const look = readLook(bg()), grid = document.createElement("div"); grid.className = "cs-filters"; grid.setAttribute("role", "radiogroup"); grid.setAttribute("aria-label", "Filter presets");
      const urls = filterThumbs();
      for (const preset of FILTER_PRESETS) {
        const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(look.preset === preset.id)); b.className = "cs-filter";
        b.innerHTML = `<span class="cs-filter-img"></span><span class="cs-filter-name"></span>`; b.lastChild.textContent = preset.name;
        const url = urls.get(preset.id); if (url) b.firstChild.style.backgroundImage = `url(${url})`;
        b.onclick = () => { history.record(); setPreset(bg(), preset.id); afterLook(); rebuild(); };
        grid.append(b);
      }
      const intensity = sliderRow({ id: "ce-ws-intensity", label: "Intensity", min: 0, max: 100, value: look.intensity, format: v => `${Math.round(v)}%`,
        onStart: () => history.record(), onInput: v => { setPreset(bg(), readLook(bg()).preset, v); afterLook(); }, onReset: () => { history.record(); setPreset(bg(), readLook(bg()).preset, 100); afterLook(); rebuild(); } });
      intensity.classList.toggle("is-disabled", look.preset === "none"); intensity.querySelector("input").disabled = look.preset === "none";
      return [hasMedia() ? null : note("Filters apply to your photo or video. On a solid canvas they tint the background colour."), grid, section(null, intensity)];
    },
    adjust() {
      const look = readLook(bg()), list = document.createElement("div"); list.className = "cs-adjust-list";
      for (const a of ADJUSTMENTS) list.append(sliderRow({ id: `ce-ws-adj-${a.key}`, label: a.label, min: a.min, max: a.max, value: look.adjust[a.key], format: v => (a.min < 0 && v > 0 ? "+" : "") + Math.round(v),
        onStart: () => history.record(), onInput: v => { setAdjust(bg(), a.key, v); afterLook(); }, onReset: () => { history.record(); resetAdjust(bg(), a.key); afterLook(); rebuild(); } }));
      const all = document.createElement("button"); all.type = "button"; all.className = "cs-text-btn"; all.textContent = "Reset all adjustments";
      all.disabled = !Object.values(look.adjust).some(Boolean);
      all.onclick = () => { history.record(); resetAllAdjust(bg()); afterLook(); rebuild(); };
      return [list, all];
    },
    canvas() {
      const geo = readGeometry(bg()), crop = bg().crop || { x: 0, y: 0, width: 1, height: 1 }, zoom = 1 / Math.max(.2, Math.min(crop.width, crop.height));
      const setTransform = next => { bg().transform = { ...readGeometry(bg()), ...next }; if (!bg().transform.rotate && !bg().transform.straighten) delete bg().transform; afterLook(); };
      const nodes = [section("Format", segmented("Aspect ratio", [["9:16", "9:16"], ["4:5", "4:5"], ["1:1", "1:1"], ["16:9", "16:9"]], project.aspect || "9:16", value => { const a = el("aspect"); a.value = value; fire(a, "change"); rebuild(); }))];
      if (hasMedia()) {
        nodes.push(section("Crop & rotate",
          actionGrid([{ label: "Rotate 90°", icon: ICON.rotate, closeFirst: false, target: () => { history.record(); setTransform({ rotate: (geo.rotate + 90) % 360 }); rebuild(); } },
            { label: "Reset geometry", icon: ICON.reset, closeFirst: false, disabled: !geo.rotate && !geo.straighten && zoom <= 1.001, target: () => { history.record(); delete bg().transform; bg().crop = { x: 0, y: 0, width: 1, height: 1 }; afterLook(); rebuild(); } }]),
          sliderRow({ id: "ce-ws-straighten", label: "Straighten", min: -45, max: 45, step: .5, value: geo.straighten, format: v => `${v > 0 ? "+" : ""}${v.toFixed(1)}°`, onStart: () => history.record(), onInput: v => setTransform({ straighten: v }), onReset: () => { history.record(); setTransform({ straighten: 0 }); rebuild(); } }),
          sliderRow({ id: "ce-ws-zoom", label: "Crop zoom", min: 1, max: 3, step: .01, value: zoom, format: v => `${v.toFixed(2)}×`, onStart: () => history.record(),
            onInput: v => { const c = bg().crop || { x: 0, y: 0, width: 1, height: 1 }, cx = c.x + c.width / 2, cy = c.y + c.height / 2, size = 1 / v; bg().crop = { width: size, height: size, x: clamp(cx - size / 2, 0, 1 - size), y: clamp(cy - size / 2, 0, 1 - size) }; afterLook(); },
            onReset: () => { history.record(); bg().crop = { x: 0, y: 0, width: 1, height: 1 }; afterLook(); rebuild(); } }),
          note("Drag the media on the preview to reposition the crop.")));
      }
      nodes.push(section("Background", actionGrid([delegate("Canvas colour", I.color, '[data-ce-rail="canvas-color"]')]),
        segmented("Layers outside frame", [["in", "Keep in frame"], ["out", "Allow outside"]], project.allowOutside ? "out" : "in", value => { const c = el("allow-outside"); c.checked = value === "out"; fire(c, "change"); rebuild(); })));
      if (project.pages?.length) nodes.push(section("Pages", segmented("Page", project.pages.map((_, i) => [String(i), `Page ${i + 1}`]), String(project.activePage || 0), value => { const s = el("pages"); s.value = value; fire(s, "change"); rebuild(); }),
        actionGrid([delegate("Remove page", I.trash, "#ce-remove-page", { closeFirst: false })])));
      return nodes;
    },
  };

  // Filter thumbnails come from the live media frame, rendered once into a small base and cached per source/geometry.
  const filterThumbs = () => {
    const source = hasMedia() ? assets.get(bg().media, time()) : null;
    const key = JSON.stringify([bg().media || bg().color, bg().crop, bg().transform, bg().kind === "video" ? Math.round(time()) : 0, project.width, project.height]);
    if (thumbs.key === key && thumbs.urls.size) return thumbs.urls;
    thumbs = { key, urls: new Map() };
    try {
      const w = 72, h = Math.round(72 * project.height / project.width), base = document.createElement("canvas"); base.width = w; base.height = h;
      const ctx = base.getContext("2d", { willReadFrequently: true }); ctx.fillStyle = bg().color || "#000"; ctx.fillRect(0, 0, w, h);
      if (source) drawBackgroundSource(ctx, source, w, h, bg());
      const original = ctx.getImageData(0, 0, w, h);
      for (const preset of FILTER_PRESETS) {
        const copy = new ImageData(new Uint8ClampedArray(original.data), w, h);
        applyLookPixels(copy.data, w, h, { preset: preset.id, intensity: 100 }); ctx.putImageData(copy, 0, 0);
        thumbs.urls.set(preset.id, base.toDataURL("image/jpeg", .72));
      }
      base.width = base.height = 0;
    } catch { /* Cross-origin media: presets still apply; thumbnails fall back to swatches. */ }
    return thumbs.urls;
  };

  const rebuild = () => { if (!open) return; const scroll = body.scrollTop; body.replaceChildren(...builders[open]().filter(Boolean)); body.scrollTop = scroll; };
  function openSheet(tool) {
    if (!canEdit()) return;
    if (open === tool) { closeSheet(); return; }
    open = tool; q("ws-sheet-title").textContent = titles[tool];
    sheet.hidden = false; sheet.dataset.tool = tool; editor.classList.add("has-ws-sheet");
    root.querySelectorAll("[data-cs-tool]").forEach(b => b.setAttribute("aria-expanded", String(b.dataset.csTool === tool)));
    rebuild(); q("compare").hidden = !(tool === "filters" || tool === "adjust" || tool === "canvas") || !hasMedia() && tool !== "filters" && tool !== "adjust";
    q("ws-sheet-close").focus({ preventScroll: true });
  }
  function closeSheet(focus = true) {
    if (!open) return false;
    const was = open; open = null; sheet.hidden = true; editor.classList.remove("has-ws-sheet"); q("compare").hidden = true; setCompare(false);
    root.querySelectorAll("[data-cs-tool]").forEach(b => b.setAttribute("aria-expanded", "false"));
    if (focus) root.querySelector(`[data-cs-tool="${was}"]`)?.focus({ preventScroll: true });
    return true;
  }
  root.querySelectorAll("[data-cs-tool]").forEach(b => b.onclick = () => openSheet(b.dataset.csTool));
  q("ws-sheet-close").onclick = () => closeSheet();

  const refresh = () => {
    if (disposed) return;
    const show = !editor.classList.contains("is-camera-open");
    editor.classList.toggle("has-workspace", show);
    if (!show) { closeSheet(false); return; }
    refreshTimeline();
    root.querySelectorAll("[data-cs-tool]").forEach(b => b.disabled = !canEdit());
    q("ws-undo").disabled = q("undo").disabled; q("ws-redo").disabled = q("redo").disabled;
    q("ws-play").innerHTML = q("play").innerHTML; q("ws-play").setAttribute("aria-label", q("play").innerHTML.includes("pause") ? "Pause" : "Play");
    const pub = q("studio-publish"); if (pub) pub.disabled = q("publish").disabled;
    if (open && !drag && !body.contains(document.activeElement)) rebuild();
  };
  return { refresh, tick, openSheet, closeSheet, isComparing: () => comparing, dispose() { disposed = true; closeSheet(false); thumbs.urls.clear(); } };
}
