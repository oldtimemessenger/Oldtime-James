import { I } from "./creative-view-icons.js";
import { renderToolSheets, renderSoundPicker, renderExitDialog } from "./creative-view-parts.js";
import { TEXT_PRESETS } from "./creative-text-effects.js";
import { renderStudioWorkspace } from "./creative-studio-workspace.js";

const PRESET_LABELS = { plain: "Plain", editorial: "Editorial", neon: "Neon", outline: "Outline", echo: "Echo", chrome: "Chrome", gold: "Gold", extruded: "Extruded" };

// Oldtime Create studio. One screen, four explicit stages driven by classes the engine already
// toggles on the root: capture (is-camera-open), edit (default), text (is-typing), details (is-details).
// Engine adapter ids (ce-*) are preserved; layout, classes and structure are new (cs-*).
export function renderCreateStudio({ destination = "post", hasSource = false, hasSaveHandler = false, esc } = {}) {
  const story = destination === "story", community = destination === "community";
  const sheets = renderToolSheets({ e: esc, story, community, isV2: true });
  const railButton = (action, label, icon, extra = "") => `<button type="button" class="cs-rail-btn" data-ce-rail="${action}" aria-label="${label}"${extra}>${icon}</button>`;
  const presetChips = TEXT_PRESETS.map(name => `<button type="button" class="cs-preset cs-preset-${name}" data-cs-preset="${name}" aria-pressed="false" aria-label="${PRESET_LABELS[name]} text style"><b class="ce-preset-aa">Aa</b><span>${PRESET_LABELS[name]}</span></button>`).join("");
  const feedAudience = `<button type="button" data-ce-audience="public" aria-pressed="${!story}">${I.share}<span><b>Everyone</b><small>Public, subject to your account privacy</small></span></button>
       <button type="button" data-ce-audience="connections" aria-pressed="false">${I.closeFriends}<span><b>Friends only</b><small>People connected to you</small></span></button>
       <button type="button" data-ce-audience="close-friends" aria-pressed="false">${I.closeFriends}<span><b>Close Friends</b><small>Only your Close Friends list</small></span></button>`;
  const storyAudience = `<button type="button" data-ce-audience="story" aria-pressed="${story}">${I.story}<span><b>Your Story</b><small>Visible to the people your account allows</small></span></button>
       <button type="button" data-ce-audience="close-friends" aria-pressed="false">${I.closeFriends}<span><b>Close Friends</b><small>Only your Close Friends list</small></span></button>`;
  return `<section class="creative-editor cs-studio is-create-v2${hasSource ? " has-source" : ""}" role="dialog" aria-modal="true" aria-labelledby="ce-title" data-destination="${destination}">
  <b id="ce-title" class="ce-sr">${story ? "Create a Story" : "Create a post"}</b>
  <div class="ce-body cs-body">
    <div class="cs-stage-wrap">
      <div class="ce-stage cs-stage"><canvas id="ce-canvas" width="1080" height="1920" aria-label="Editing canvas"></canvas>
        <div id="ce-trash" class="ce-trash" aria-label="Drop here to delete">${I.trash}</div>
        <div id="ce-safe-guides" class="ce-safe-guides" aria-hidden="true"></div>
        <div id="ce-inline-text" class="ce-inline-text" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Text on media" spellcheck="false" hidden></div>
        <button type="button" id="ce-text-done" class="ce-primary ce-text-done" hidden>Done</button>
        <div class="cs-grid" aria-hidden="true"></div>
        <div class="cs-cam-chrome">
          <button type="button" id="ce-flash" class="cs-cam-btn" aria-pressed="false" aria-label="Flash" disabled>${I.flash}</button>
          <span id="ce-recording-indicator" class="cs-rec-badge" role="status" aria-live="off"></span>
          <div id="ce-sound-pill" class="cs-sound-pill" hidden>
            <button type="button" id="ce-sound-pill-main" class="cs-sound-pill-main" aria-label="Change selected sound">
              <img id="ce-sound-pill-art" alt="" hidden>
              <span id="ce-sound-pill-icon" class="cs-sound-pill-icon" aria-hidden="true">${I.music}</span>
              <span id="ce-sound-pill-title" class="cs-sound-pill-title"></span><small>60s max</small>
            </button>
            <button type="button" id="ce-sound-preview-toggle" class="cs-sound-pill-preview" aria-label="Preview selected sound" aria-pressed="false">${I.play}</button>
            <button type="button" id="ce-sound-pill-remove" class="cs-sound-pill-remove" aria-label="Remove selected sound">×</button>
          </div>
          <button type="button" id="ce-flip" class="cs-cam-btn" aria-label="Flip camera" hidden>${I.flip}</button>
        </div>
        <div class="ce-messages cs-messages"><p id="ce-status" class="ce-status" role="status"></p><p id="ce-error" class="ce-error" role="alert"></p></div>
      </div>
      ${renderSoundPicker(I, { includeTrigger: false })}
      <div class="ce-video-context cs-video-tools" aria-label="Video tools" hidden>
        <button type="button" class="cs-chip" data-ce-media-tool="trim" aria-label="Trim video">${I.scissors}<span>Trim</span></button>
        <button type="button" class="cs-chip" data-ce-quick-split aria-label="Split at playhead">${I.split}<span>Split</span></button>
        <button type="button" class="cs-chip" data-ce-media-tool="speed" aria-label="Speed">${I.speed}<span>Speed</span></button>
        <div id="ce-clip-list" class="ce-clip-list" role="list" aria-label="Clips"></div>
      </div>
      <div class="ce-transport cs-transport">
        <button type="button" id="ce-play" class="cs-round" aria-label="Play or pause">${I.play}</button>
        <div class="ce-timeline cs-timeline"><div id="ce-filmstrip" class="ce-filmstrip" aria-hidden="true"></div><input id="ce-scrub" type="range" min="0" max="1" step="0.01" value="0" aria-label="Scrub timeline"><button id="ce-trim-handle-start" class="ce-trim-handle" type="button" aria-label="Drag clip start" hidden></button><button id="ce-trim-handle-end" class="ce-trim-handle" type="button" aria-label="Drag clip end" hidden></button></div>
        <span id="ce-time" class="ce-time cs-time">0:00</span>
      </div>
    </div>

    <header class="cs-top">
      <button type="button" id="ce-close" class="cs-round" aria-label="Close editor">${I.close}</button>
        <details class="cs-cam-options cs-title-options"><summary class="cs-title" aria-label="${story ? "New story" : "New post"} camera options">${story ? "New story" : "New post"}</summary>
          <div class="ce-camera-controls cs-pop">
            <label class="ce-field ce-inline" for="ce-zoom"><span>Zoom</span><input id="ce-zoom" type="range" min="1" max="4" step="0.1" value="1"></label>
            <label class="ce-field ce-inline" for="ce-camera-timer"><span>Timer</span><select id="ce-camera-timer"><option value="0">Off</option><option value="3">3s</option><option value="10">10s</option></select></label>
            <button type="button" id="ce-canvas-start" class="cs-row-btn" data-ce-add="text" aria-label="Start a blank canvas">${I.text}<span>Blank canvas</span></button>
          </div></details>
      <div class="cs-top-end">
        <button type="button" id="ce-studio-publish" class="cs-studio-publish cs-ws-only" disabled>Publish</button>
        <details class="ce-menu ce-header-menu cs-menu cs-edit-only" name="ce-menu"><summary class="cs-round" aria-label="More actions">${I.more}</summary>
          <div class="ce-menu-pop cs-pop">
            ${hasSaveHandler ? `<button type="button" id="ce-save-exit" class="ce-chip">Save &amp; Exit</button><span id="ce-save-hint" class="ce-sr">Returns the edit to its original composer without sharing.</span>` : ""}
            <button type="button" id="ce-layers-toggle" class="cs-row-btn" aria-expanded="false" aria-controls="ce-layer-list">${I.layers}<span class="ce-lbl">Layers</span></button>
            <button type="button" id="ce-preview" class="cs-row-btn" aria-pressed="false">${I.eye}<span class="ce-lbl">Preview</span></button>
            <button type="button" id="ce-export" class="cs-row-btn" disabled>${I.download}<span class="ce-lbl">Download</span></button>
            <div class="ce-theme cs-theme" role="group" aria-label="Tools theme"><span class="ce-theme-label">Tools</span><button type="button" class="ce-theme-btn" data-ce-tools-theme="light" aria-pressed="false">White</button><button type="button" class="ce-theme-btn" data-ce-tools-theme="dark" aria-pressed="true">Black</button></div>
          </div></details>
      </div>
    </header>


    <nav class="cs-rail cs-edit-only" aria-label="Editing tools">
      ${railButton("text", "Text", I.text)}
      ${railButton("templates", "Styles", I.frames)}
      <button type="button" class="cs-rail-btn" data-ce-rail="sound" id="ce-sound-chip" aria-label="Choose sound" aria-expanded="false">${I.music}<span id="ce-sound-title" class="ce-sr">Choose sound</span></button>
      ${railButton("draw", "Draw", I.draw)}
      ${railButton("overlay", "Overlay", I.image)}
      ${railButton("remove-bg", "Remove BG", I.removeBg)}
      ${railButton("adjust", "Adjust", I.sliders)}
      ${railButton("canvas-color", "Canvas", I.color)}
    </nav>

    <div id="ce-camera-bar" class="cs-capture">
      <div id="ce-camera-strip" class="ce-camera-strip cs-strip" hidden></div>
      <div id="ce-capture-picker" class="cs-modes" role="tablist" aria-label="Capture mode" hidden>
        ${[["photo", "Photo"], ["video", "Video"]].map(([mode, label]) => `<button type="button" role="tab" data-ce-capture-mode="${mode}" aria-selected="${mode === "photo"}">${label}</button>`).join("")}
      </div>
      <div class="cs-capture-row">
        <div class="cs-gallery-wrap"><div id="ce-camera-gallery-slot" class="cs-gallery"></div></div>
        <div class="cs-shutter-wrap">
          <button type="button" id="ce-shutter" class="ce-shutter cs-shutter" aria-label="Take photo" aria-description="Tap to take a photo. Press and hold to switch to video." disabled><span aria-hidden="true"></span></button>
        </div>
        <div class="cs-capture-side">
          <button type="button" id="ce-camera-reset" class="cs-round" aria-label="Restart camera">${I.undo}</button>
        </div>
      </div>
      <span id="ce-capture-label" class="ce-capture-label ce-sr" aria-live="polite">Photo</span>
      <div class="ce-capture-modes" hidden>
        <button type="button" id="ce-photo" class="ce-camera-mode" aria-pressed="true">Photo</button>
        <button type="button" id="ce-record" class="ce-camera-mode" aria-pressed="false">Video</button>
      </div>
    </div>

    <div class="cs-edit-foot cs-edit-only">
      <div class="cs-history" role="group" aria-label="Edit history">
        <button type="button" id="ce-undo" class="cs-round" aria-label="Undo">${I.undo}</button>
        <button type="button" id="ce-redo" class="cs-round" aria-label="Redo">${I.redo}</button>
      </div>
      <button type="button" id="ce-next-action" class="cs-next" aria-label="Next" disabled><span>Next</span>${I.arrowNext}</button>
    </div>
    <button type="button" id="ce-publish" class="ce-primary" hidden disabled>Next</button>
    ${renderStudioWorkspace()}
    <button type="button" id="ce-back" class="ce-sr" aria-label="Back to previous creation step"></button>

    <div class="cs-adapters" hidden>
      <button type="button" class="ce-tool" data-ce-add="text" aria-label="Add Text" tabindex="-1">Text</button>
      <button type="button" id="ce-draw" class="ce-tool" aria-pressed="false" tabindex="-1">Draw</button>
      <button type="button" id="ce-source-toggle" aria-expanded="false" tabindex="-1">Source</button>
      <button type="button" id="ce-style-toggle" aria-expanded="false" tabindex="-1">Style</button>
      <button type="button" id="ce-share-toggle" aria-expanded="false" tabindex="-1">Caption</button>
      <input id="ce-image-upload" type="file" accept="image/*" aria-label="Add image layer">
      <div id="ce-feed-privacy"></div>
    </div>
    ${sheets.media}

    <div id="ce-text-bar" class="cs-textbar" role="toolbar" aria-label="Text style" hidden>
      <div id="ce-text-presets" class="cs-strip-row" role="group" aria-label="Text styles">${presetChips}</div>
      <div id="ce-text-fonts" class="cs-strip-row" role="group" aria-label="Font"></div>
      <div class="cs-strip-row cs-text-row" role="group" aria-label="Text color and layout">
        <label class="cs-custom-color" aria-label="Custom text color"><input type="color" id="ce-text-custom" value="#ffffff"><span aria-hidden="true"></span></label>
        <div id="ce-text-colors" class="cs-colors" role="group" aria-label="Color"></div>
        <button type="button" id="ce-text-align" class="cs-round" aria-label="Alignment">${I.text}</button>
        <button type="button" id="ce-text-bg" class="cs-round" aria-pressed="false" aria-label="Text background"><b>A</b></button>
        <button type="button" id="ce-text-dup" class="cs-round" aria-label="Duplicate text">${I.frames}</button>
        <button type="button" id="ce-text-del" class="cs-round" aria-label="Delete text">${I.trash}</button>
      </div>
      <label class="cs-size" for="ce-text-size"><span>Size</span><input id="ce-text-size" type="range" min="16" max="180" step="1" value="64" aria-label="Text size"></label>
    </div>

    ${sheets.panel}

    <section id="ce-details" class="ce-details cs-details" role="dialog" aria-modal="true" aria-labelledby="ce-details-title" data-ce-kind="${story ? "story" : "post"}" hidden>
      <header class="cs-details-head"><button type="button" id="ce-details-back" class="cs-round" aria-label="Back to editor">${I.close}</button><b id="ce-details-title">${story ? "Share to Story" : "New post"}</b></header>
      <div class="cs-details-body">
        <div id="ce-details-fields" class="ce-details-fields cs-fields"><label class="ce-field ce-preview-caption" for="ce-caption"><textarea id="ce-caption" rows="3" maxlength="1000" placeholder="${story ? "Add a caption" : "Write a caption"}" aria-label="Caption"></textarea></label></div>
        <div id="ce-destination-options" class="cs-destination-options" role="group" aria-label="Share to">
          <button type="button" data-ce-destination="post" aria-pressed="${!story}">${I.share}<span>Main Feed</span></button>
          <button type="button" data-ce-destination="story" aria-pressed="${story}">${I.story}<span>Your Story</span></button>
        </div>
        <div id="ce-feed-audience" class="ce-audience cs-audience" data-ce-audience-group="post" role="group" aria-label="Feed audience" ${story ? "hidden" : ""}>${feedAudience}</div>
        <div id="ce-story-audience" class="ce-audience cs-audience" data-ce-audience-group="story" role="group" aria-label="Story audience" ${story ? "" : "hidden"}>${storyAudience}</div>
        <section id="ce-sound-rights" class="cs-sound-rights" aria-label="Sound reuse permission" hidden>
          <b>Sound reuse</b>
          <label><input id="ce-sound-rights-confirm" type="checkbox"><span>Allow people to reuse this audio.</span></label>
          <p id="ce-sound-rights-note">Only share audio you own or have permission to share. Reuse links to the original post and creator; Old Time does not keep a separate audio copy.</p>
        </section>
        <p id="ce-details-status" class="ce-details-status" role="status"></p>
        <p id="ce-audio-warning" class="ce-details-status" role="status" hidden></p>
        <p id="ce-details-error" class="ce-details-error" role="alert"></p>
        <details id="ce-details-diagnostic" class="ce-details-diagnostic" hidden>
          <summary>Technical details</summary>
          <pre id="ce-details-diagnostic-text"></pre>
        </details>
      </div>
      <footer class="cs-details-foot"><button type="button" id="ce-details-publish" class="cs-publish">Publish</button></footer>
    </section>
    ${renderExitDialog()}
  </div>
</section>`;
}
