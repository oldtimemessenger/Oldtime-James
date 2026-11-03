import { I } from "./creative-view-icons.js";

// Tool-sheet bodies shared by the legacy editor and the Create studio. Control ids are the
// engine adapters (stickers, draw, inspector, share fields, media tools); markup is unchanged.
const fallbackEsc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderToolSheets({ e = fallbackEsc, story = false, community = false, isV2 = false } = {}) {
  const range = (id, label, min, max, step, val) =>
    `<label class="ce-field"${["ce-letter-spacing","ce-line-spacing","ce-background-opacity","ce-scale","ce-rotation"].includes(id) ? " data-ce-advanced-only" : ""} for="${id}"><span>${e(label)}</span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
  const panel = `    <div class="ce-panel" id="ce-panel">
      <div class="ce-row ce-source is-collapsed">
        <input id="ce-upload" type="file" accept="image/*,video/*" multiple hidden>
        <label for="ce-upload" class="ce-chip">${I.upload}<span>Background photo or video</span></label>
        <label class="ce-chip ce-canvas-color" for="ce-canvas-color"><span>Canvas color</span><input id="ce-canvas-color" type="color" value="#000000"></label>
        <button type="button" id="ce-camera" class="ce-chip">${I.camera}<span>Camera</span></button>
      </div>
      <div data-ce-advanced-only id="ce-page-tools" class="ce-row" hidden><label class="ce-field">Gallery page<select id="ce-pages"></select></label><button id="ce-remove-page" type="button" class="ce-chip">Remove page</button></div>
      <div class="ce-group ce-canvas-opts" data-ce-advanced-only>
        <label class="ce-field" for="ce-aspect"><span>Aspect</span><select id="ce-aspect"><option value="9:16">9:16</option><option value="1:1">1:1</option><option value="4:5">4:5</option><option value="16:9">16:9</option></select></label>
        <label class="ce-check" for="ce-safe"><input id="ce-safe" type="checkbox" checked><span>Safe guides</span></label>
        <label class="ce-check" for="ce-allow-outside"><input id="ce-allow-outside" type="checkbox"><span>Allow outside bounds</span></label>
      </div>
      <div id="ce-comments" class="ce-group" hidden>
        <label class="ce-field" for="ce-comment-select"><span>Comment</span><select id="ce-comment-select"></select></label>
        <button type="button" id="ce-comment-add" class="ce-chip">Add comment</button>
      </div>
      <div id="ce-draw-controls" class="ce-group ce-draw-controls">
        <label class="ce-field" for="ce-brush"><span>Brush</span><select id="ce-brush"><option value="pen">Pen</option><option value="marker">Marker</option><option value="highlighter">Highlighter</option><option value="eraser">Eraser</option><option value="handwriting">Handwriting</option></select></label>
        ${range("ce-draw-opacity", "Brush opacity", 0.1, 1, 0.05, 1)}
        <label class="ce-field ce-color-field" for="ce-draw-color"><span>Brush color</span><input id="ce-draw-color" type="color" value="#e0245e"></label>
        ${range("ce-draw-width", "Brush width", 2, 80, 1, 12)}
      </div>
      <div id="ce-layer-list" class="ce-layer-list" role="listbox" aria-label="Layers"></div>
      <div id="ce-inspector" class="ce-inspector is-collapsed" hidden>
        <div id="ce-text-fields" class="ce-text-fields ce-group">
          <label class="ce-field" for="ce-text"><span>Text</span><textarea id="ce-text" rows="2"></textarea></label>
          <label class="ce-field" for="ce-font"><span>Font</span><select id="ce-font"><option value="Manrope">Manrope</option><option value="Georgia">Georgia</option><option value="monospace">Monospace</option><option value="system-ui">System</option></select></label>
          <label class="ce-field" for="ce-align"><span>Alignment</span><select id="ce-align"><option value="left">Left</option><option value="center" selected>Center</option><option value="right">Right</option></select></label>
          <label class="ce-field ce-color-field" for="ce-color"><span>Text color</span><input id="ce-color" type="color" value="#ffffff"></label>
          <label class="ce-field ce-color-field" for="ce-background"><span>Background</span><input id="ce-background" type="color" value="#000000"></label>
          <label class="ce-check" for="ce-background-on"><input id="ce-background-on" type="checkbox"><span>Text background (optional)</span></label>
          ${range("ce-font-size", "Font size", 16, 180, 1, 64)}
          <label class="ce-field" for="ce-text-width"><span>Text width</span><input id="ce-text-width" type="range" min=".08" max="1" step=".01" value=".7" aria-label="Text box width as a fraction of project width"></label>
          <div class="ce-presets" role="group" aria-label="Text style presets">
            <p class="ce-sub">Text styles</p>
            <div class="ce-preset-grid"><button type="button" class="ce-preset" data-ce-text-preset="plain" data-preset="plain" aria-label="Plain text style"><span class="ce-preset-aa" aria-hidden="true">Aa</span><span class="ce-preset-name">Plain</span></button><button type="button" class="ce-preset" data-ce-text-preset="editorial" data-preset="editorial" aria-label="Serif text style"><span class="ce-preset-aa" aria-hidden="true">Aa</span><span class="ce-preset-name">Serif</span></button><button type="button" class="ce-preset" data-ce-text-preset="neon" data-preset="neon" aria-label="Neon text style"><span class="ce-preset-aa" aria-hidden="true">Aa</span><span class="ce-preset-name">Neon</span></button><button type="button" class="ce-preset" data-ce-text-preset="outline" data-preset="outline" aria-label="Outline text style"><span class="ce-preset-aa" aria-hidden="true">Aa</span><span class="ce-preset-name">Outline</span></button><button type="button" class="ce-preset" data-ce-text-preset="echo" data-preset="echo" aria-label="Echo text style"><span class="ce-preset-aa" aria-hidden="true">Aa</span><span class="ce-preset-name">Echo</span></button><button type="button" class="ce-preset" data-ce-text-preset="chrome" data-preset="chrome" aria-label="Chrome text style"><span class="ce-preset-aa" aria-hidden="true">Aa</span><span class="ce-preset-name">Chrome</span></button><button type="button" class="ce-preset" data-ce-text-preset="gold" data-preset="gold" aria-label="Gold text style"><span class="ce-preset-aa" aria-hidden="true">Aa</span><span class="ce-preset-name">Gold</span></button><button type="button" class="ce-preset" data-ce-text-preset="extruded" data-preset="extruded" aria-label="Extruded text style"><span class="ce-preset-aa" aria-hidden="true">Aa</span><span class="ce-preset-name">Extruded</span></button></div>
            ${range("ce-effect-strength", "Effect strength", 0, 100, 1, 60)}
            <label class="ce-field ce-color-field" for="ce-effect-color"><span>Effect color</span><input id="ce-effect-color" type="color" value="#b51e29"></label>
          </div>
          <div class="ce-row"><label class="ce-check" for="ce-bold"><input id="ce-bold" type="checkbox"><span>Bold</span></label><label class="ce-check" for="ce-italic"><input id="ce-italic" type="checkbox"><span>Italic</span></label><label class="ce-check" for="ce-shadow"><input id="ce-shadow" type="checkbox"><span>Shadow</span></label><label class="ce-check" for="ce-outline"><input id="ce-outline" type="checkbox"><span>Outline</span></label></div>
          ${range("ce-background-opacity", "Background opacity", 0, 1, 0.05, 1)}
          ${range("ce-letter-spacing", "Letter spacing", -4, 20, 0.5, 0)}
          ${range("ce-line-spacing", "Line spacing", 0.9, 2, 0.05, 1.2)}
          <label class="ce-field" data-ce-advanced-only for="ce-case"><span>Case</span><select id="ce-case"><option value="none">None</option><option value="uppercase">Uppercase</option><option value="lowercase">Lowercase</option></select></label>
          <label class="ce-field" data-ce-advanced-only for="ce-bubble"><span>Bubble</span><select id="ce-bubble"><option value="rounded">Rounded</option><option value="pill">Pill</option><option value="square">Square</option><option value="none">None</option></select></label>
          <label class="ce-field" data-ce-advanced-only for="ce-animation"><span>Animation</span><select id="ce-animation"><option value="none">None</option><option value="fade">Fade</option><option value="pop">Pop</option><option value="slide">Slide</option></select></label>
        </div>
        <div class="ce-group">
          ${range("ce-opacity", "Opacity", 0, 1, 0.05, 1)}
          <label class="ce-field" data-ce-advanced-only for="ce-blend"><span>Blend</span><select id="ce-blend"><option value="source-over">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option><option value="soft-light">Soft light</option><option value="hard-light">Hard light</option><option value="darken">Darken</option><option value="lighten">Lighten</option><option value="color-dodge">Color dodge</option><option value="color-burn">Color burn</option><option value="difference">Difference</option><option value="exclusion">Exclusion</option><option value="hue">Hue</option><option value="saturation">Saturation</option><option value="color">Color</option><option value="luminosity">Luminosity</option></select></label>
          ${range("ce-scale", "Scale", 0.08, 3, 0.01, 1)}
          ${range("ce-rotation", "Rotation", -180, 180, 1, 0)}
        </div>
        <div data-ce-advanced-only id="ce-timing" class="ce-group ce-timing ce-row">
          <div class="ce-handles"><label class="ce-field" for="ce-overlay-start"><span>In</span><input id="ce-overlay-start" type="range" min="0" max="1" step="0.01" value="0"></label><label class="ce-field" for="ce-overlay-end"><span>Out</span><input id="ce-overlay-end" type="range" min="0" max="1" step="0.01" value="1"></label><p id="ce-timeline-summary" class="ce-status"></p></div>
          <label class="ce-field" for="ce-start"><span>Start (s)</span><input id="ce-start" type="number" min="0" step="0.1" value="0"></label>
          <label class="ce-field" for="ce-end"><span>End (s)</span><input id="ce-end" type="number" min="0" step="0.1"></label>
        </div>
        <div class="ce-row ce-actions">
          <button type="button" id="ce-lock" class="ce-chip" aria-pressed="false">Lock</button>
          <button type="button" id="ce-hide" class="ce-chip" aria-pressed="false">Hide</button>
          <button type="button" data-ce-advanced-only id="ce-backward" class="ce-chip">Send back</button>
          <button type="button" data-ce-advanced-only id="ce-forward" class="ce-chip">Bring forward</button>
          <button type="button" data-ce-advanced-only id="ce-duplicate" class="ce-chip">Duplicate</button>
          <button type="button" id="ce-delete" class="ce-chip ce-danger">Delete</button>
        </div>
      </div>
      <div id="ce-subject-controls" class="ce-group" hidden>
        <button type="button" id="ce-behind-subject" class="ce-chip" aria-pressed="false" hidden>Text behind subject</button>
        <div id="ce-edge-controls" hidden>
          <p class="ce-subject-heading">Refine subject edges</p>
          <button type="button" id="ce-refine-mask" class="ce-chip" hidden>Brush refine</button>
          <label class="ce-field" for="ce-edge-shift"><span>Edge</span><input id="ce-edge-shift" type="range" min="-50" max="50" step="1" value="0"></label>
          <label class="ce-field" for="ce-edge-feather"><span>Feather</span><input id="ce-edge-feather" type="range" min="0" max="50" step="1" value="0"></label>
          <button type="button" id="ce-edge-reset" class="ce-chip">Reset edges</button>
        </div>
      </div>
      <div class="ce-group ce-share is-collapsed">
        <label class="ce-field" for="ce-destination"><span>Share to</span><select id="ce-destination"><option value="post"${!story && !community ? " selected" : ""}>Main feed</option><option value="community"${community ? " selected" : ""}>Community</option><option value="story"${story ? " selected" : ""}>Story</option></select></label>
        <label class="ce-share-crosspost" id="ce-other-feed-field"><input id="ce-other-feed" type="checkbox"><span id="ce-other-feed-label">${community ? "Also share to Main feed" : "Also share to Community"}</span></label>
        <label class="ce-field" for="ce-location"><span>Location</span><input id="ce-location" type="text" maxlength="80" placeholder="Add location"></label>
        ${isV2 ? "" : `<label class="ce-field" for="ce-caption"><span>Caption</span><textarea id="ce-caption" rows="2" maxlength="1000" placeholder="Write a caption"></textarea></label>`}
          <label class="ce-field" for="ce-visibility"><span>Audience</span><select id="ce-visibility"><option value="public">Everyone</option><option value="followers">Followers</option><option value="friends">Friends</option><option value="connections">Friends &amp; Followers</option><option value="close-friends">Close Friends</option></select></label>
        ${isV2 ? `<button type="button" id="ce-final-share" class="ce-primary">Share now</button>` : ""}
      </div>
    </div>`;
  const media = `    <div id="ce-media-panel" class="ce-media-panel" hidden>
      <div class="ce-media-head"><b id="ce-media-title">Trim</b><button type="button" id="ce-media-close" class="ce-icon-btn" aria-label="Close video tool">${I.close}</button></div>
      <div class="ce-media-body">
        <div data-ce-media-panel="trim" class="ce-row">
          <label class="ce-field" for="ce-trim-start"><span>Start (s)</span><input id="ce-trim-start" type="number" min="0" step="0.1" value="0"></label><label class="ce-field" for="ce-trim-end"><span>End (s)</span><input id="ce-trim-end" type="number" min="0" step="0.1" value="0"></label>
          <button type="button" id="ce-split" class="ce-chip">${I.split}<span>Split</span></button>
          <button type="button" id="ce-clip-prev" class="ce-chip">Move earlier</button>
          <button type="button" id="ce-clip-next" class="ce-chip">Move later</button>
          <button type="button" id="ce-clip-delete" class="ce-chip ce-danger">Delete clip</button>
        </div>
        <div data-ce-media-panel="speed" hidden><label class="ce-field" for="ce-speed"><span>Speed <output for="ce-speed" id="ce-speed-value">1</output></span><input id="ce-speed" type="range" min="0.25" max="2" step="0.05" value="1"></label></div>
        <div data-ce-media-panel="color" hidden><label class="ce-field" for="ce-brightness"><span>Brightness <output for="ce-brightness" id="ce-brightness-value">100</output></span><input id="ce-brightness" type="range" min="50" max="150" step="1" value="100"></label><label class="ce-field" for="ce-contrast"><span>Contrast <output for="ce-contrast" id="ce-contrast-value">100</output></span><input id="ce-contrast" type="range" min="50" max="150" step="1" value="100"></label><label class="ce-field" for="ce-saturation"><span>Saturation <output for="ce-saturation" id="ce-saturation-value">100</output></span><input id="ce-saturation" type="range" min="50" max="150" step="1" value="100"></label></div>
      </div>
    </div>`;
  return { panel, media };
}

export function renderSoundPicker(I, { includeTrigger = true } = {}) {
  return `${includeTrigger ? `<button type="button" id="ce-sound-chip" class="ce-sound-chip" aria-label="Add sound">
          ${I.music}<span id="ce-sound-title">Add sound</span><span class="ce-sound-plus" aria-hidden="true">+</span>
        </button>` : ""}
        <section id="ce-sound-picker" class="ce-sound-picker" role="dialog" aria-labelledby="ce-sound-heading" hidden>
          <header class="ce-sound-picker-head"><b id="ce-sound-heading">Add sound</b><button type="button" id="ce-sound-close" aria-label="Close sound picker">${I.close}</button></header>
          <div class="ce-sound-tabs" role="tablist" aria-label="Sound options"><button type="button" data-sound-mode="trending" aria-selected="true">Trending</button><button type="button" data-sound-mode="saved" aria-selected="false">Saved</button></div>
          <button type="button" id="ce-sound-upload-open" class="ce-sound-upload">${I.upload}<span>Choose audio from this device</span></button>
          <input type="file" id="ce-sound-upload" accept="audio/*" hidden>
          <div id="ce-sound-list" class="ce-sound-list" aria-label="Sound choices"></div>
          <label id="ce-sound-volume-wrap" class="ce-sound-volume" for="ce-sound-volume" hidden><span>Music volume</span><input id="ce-sound-volume" type="range" min="0" max="1" step="0.05" value="0.8"></label>
          <label id="ce-original-audio-wrap" class="ce-original-audio-wrap" hidden>
            <input id="ce-original-audio-toggle" type="checkbox">
            <span><b>Mute original video sound</b><small>Added sounds stay on.</small></span>
          </label>
          <button type="button" id="ce-sound-remove" class="ce-sound-remove" hidden>Remove sound</button>
          <p id="ce-sound-error" class="ce-sound-error" role="alert"></p>
        </section>`;
}

export function renderExitDialog() {
  return `  <div id="ce-exit-dialog" class="ce-exit-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ce-exit-title" aria-describedby="ce-exit-description" hidden>
    <div class="ce-exit-card"><h2 id="ce-exit-title">Leave the editor?</h2><p id="ce-exit-description">Your unsaved changes will be discarded. Nothing will be shared.</p>
      <button type="button" id="ce-exit-discard" class="ce-chip ce-danger">Discard edit</button>
      <button type="button" id="ce-exit-cancel" class="ce-chip">Keep editing</button>
    </div>
  </div>`;
}
