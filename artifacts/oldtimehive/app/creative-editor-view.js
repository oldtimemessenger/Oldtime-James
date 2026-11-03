import { I } from "./creative-view-icons.js";
import { renderToolSheets, renderSoundPicker, renderExitDialog } from "./creative-view-parts.js";
import { renderCreateStudio } from "./creative-create-view.js";

const fallbackEsc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderCreativeEditor({ destination = "post", hasSource = false, hasSaveHandler = false, responseStudio = false, esc = fallbackEsc, icons = {}, editorVersion = "legacy" } = {}) {
  const e = esc || fallbackEsc;
  const isV2 = editorVersion === "v2";
  if (isV2) return renderCreateStudio({ destination, hasSource, hasSaveHandler, esc: e, icons });
  const story = destination === "story";
  const community = destination === "community";
  const sheets = renderToolSheets({ e, story, community, isV2 });
  const tool = (k, label, icon) =>
    `<button type="button" class="ce-tool" data-ce-add="${k}"${["emoji","image","drawing","comment"].includes(k) ? " data-ce-advanced-only" : ""} aria-label="Add ${e(label)}">${icon}<span>${e(label)}</span></button>`;
  const v2Rail = isV2 ? `<nav class="ce-side-rail" aria-label="Editing tools">
        <button type="button" data-ce-rail="text" aria-label="Add text">${I.text}<span>Text</span></button>
        <button type="button" data-ce-rail="draw" aria-label="Draw on media">${I.draw}<span>Draw</span></button>
        <button type="button" data-ce-rail="trim" aria-label="Trim video">${I.scissors}<span>Trim</span></button>
        <button type="button" data-ce-rail="templates" aria-label="Text templates">${I.frames}<span>Templates</span></button>
        <button type="button" data-ce-rail="overlay" aria-label="Add photo overlay">${I.image}<span>Overlay</span></button>
        <button type="button" data-ce-rail="remove-bg" aria-label="Remove background">${I.removeBg}<span>Remove BG</span></button>
        <button type="button" data-ce-rail="canvas-color" aria-label="Canvas color">${I.color}<span>Color</span></button>
        <button type="button" data-ce-rail="layers" aria-label="Show layers">${I.layers}<span>Layers</span></button>
        <button type="button" data-ce-rail="caption" aria-label="Caption and sharing options">${I.caption}<span>Share</span></button>
        <button type="button" data-ce-rail="more" aria-label="More editing tools">${I.chev}<span>More</span></button>
      </nav>` : "";
  const legacyDestinations = `<div class="ce-media-destination-row" role="group" aria-label="Choose where to share">
        <button type="button" data-ce-share-destination="feed" aria-pressed="${!story && !community}">Feed</button>
        <button type="button" data-ce-share-destination="story" aria-pressed="${story}">Story</button>
        <button type="button" data-ce-share-destination="close-friends" aria-pressed="false">Close Friends</button>
      </div>`;
  const v2Footer = isV2 ? `<section id="ce-details" class="ce-details" role="dialog" aria-modal="true" aria-labelledby="ce-details-title" data-ce-kind="${story ? "story" : "post"}" hidden>
      <header class="ce-details-head"><button type="button" id="ce-details-back" class="ce-icon-btn" aria-label="Back to editor"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button><b id="ce-details-title">${story ? "Share to Story" : "New post"}</b></header>
      <div class="ce-details-body">
        <div id="ce-details-fields" class="ce-details-fields"></div>
        <div class="ce-audience" role="group" aria-label="Audience">
          ${story ? `<button type="button" data-ce-audience="story" aria-pressed="true">${I.story}<span><b>Your Story</b><small>Visible to the people your account allows</small></span></button>
          <button type="button" data-ce-audience="close-friends" aria-pressed="false">${I.closeFriends}<span><b>Close Friends</b><small>Only your Close Friends list</small></span></button>`
          : `<button type="button" data-ce-audience="public" aria-pressed="true">${I.share}<span><b>Main Feed</b><small>Public, subject to your account privacy</small></span></button>
          <button type="button" data-ce-audience="connections" aria-pressed="false">${I.closeFriends}<span><b>Friends only</b><small>People connected to you</small></span></button>
          <button type="button" data-ce-audience="close-friends" aria-pressed="false">${I.closeFriends}<span><b>Close Friends</b><small>Only your Close Friends list</small></span></button>`}
        </div>
        <p id="ce-details-status" class="ce-details-status" role="status"></p>
        <p id="ce-details-error" class="ce-details-error" role="alert"></p>
        <details id="ce-details-diagnostic" class="ce-details-diagnostic" hidden>
          <summary>Technical details</summary>
          <pre id="ce-details-diagnostic-text"></pre>
        </details>
      </div>
      <footer class="ce-details-foot"><button type="button" id="ce-details-publish" class="ce-primary">Publish</button></footer>
    </section>
    <div class="ce-bottom-actions"><button type="button" id="ce-next-action" class="ce-next-action" aria-label="Next" disabled><span>Next</span>${I.arrowNext}</button></div>` : "";
  const v2TextBar = isV2 ? `<div id="ce-text-bar" class="ce-text-bar" role="toolbar" aria-label="Text style" hidden>
      <div id="ce-text-fonts" class="ce-text-strip" role="group" aria-label="Font"></div>
      <div class="ce-text-strip ce-text-row" role="group" aria-label="Text color and layout">
        <div id="ce-text-colors" class="ce-text-colors" role="group" aria-label="Color"></div>
        <button type="button" id="ce-text-align" class="ce-text-btn" aria-label="Alignment">${I.text}</button>
        <button type="button" id="ce-text-bg" class="ce-text-btn" aria-pressed="false" aria-label="Text background"><b>A</b></button>
        <button type="button" id="ce-text-dup" class="ce-text-btn" aria-label="Duplicate text">${I.frames}</button>
        <button type="button" id="ce-text-del" class="ce-text-btn" aria-label="Delete text">${I.trash}</button>
      </div>
    </div>` : "";
  const v2Caption = isV2 ? `<label class="ce-field ce-preview-caption" for="ce-caption"><textarea id="ce-caption" rows="1" maxlength="1000" placeholder="Add a caption..." aria-label="Add a caption"></textarea></label>` : "";
  return `<section class="creative-editor is-basic${isV2 ? " is-create-v2" : ""}${responseStudio ? " is-response-studio" : ""}${hasSource ? " has-source" : ""}" role="dialog" aria-modal="true" aria-labelledby="ce-title" data-destination="${e(destination)}">
  <header class="ce-head">
    <button type="button" id="ce-back" class="ce-icon-btn" aria-label="Back to previous creation step"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
    <button type="button" id="ce-close" class="ce-icon-btn" aria-label="Close editor">${icons.close || I.close}</button>
    <b id="ce-title">Create</b>
    <div class="ce-head-actions">
      <details class="ce-camera-settings"><summary aria-label="Camera options">${I.sliders}</summary>
      <div class="ce-camera-controls">
        <label class="ce-field ce-inline" for="ce-zoom"><span>Zoom</span><input id="ce-zoom" type="range" min="1" max="4" step="0.1" value="1"></label>
        <label class="ce-field ce-inline" for="ce-camera-timer"><span>${I.timer}Timer</span><select id="ce-camera-timer"><option value="0">Off</option><option value="3">3s</option><option value="10">10s</option></select></label>
      </div>
      </details>
      <details class="ce-menu ce-header-menu" name="ce-menu"><summary aria-label="Editing actions">${I.more}</summary><div class="ce-menu-pop">
      ${hasSaveHandler ? `<div class="ce-save-bar"><button type="button" id="ce-save-exit" class="ce-chip">Save &amp; Exit</button><span id="ce-save-hint" class="ce-sr">Returns the edit to its original composer without sharing.</span></div>` : ""}
      <div class="ce-theme" role="group" aria-label="Tools theme"><span class="ce-theme-label">Tools</span><button type="button" class="ce-theme-btn" data-ce-tools-theme="light" aria-pressed="false">White</button><button type="button" class="ce-theme-btn" data-ce-tools-theme="dark" aria-pressed="true">Black</button></div>
      <button type="button" id="ce-undo" class="ce-chip" aria-label="Undo">${I.undo}<span class="ce-lbl">Undo</span></button>
      <button type="button" id="ce-redo" class="ce-chip" aria-label="Redo">${I.redo}<span class="ce-lbl">Redo</span></button>
      <button type="button" id="ce-layers-toggle" class="ce-chip" aria-expanded="false" aria-controls="ce-layer-list" aria-label="Layers">${I.layers}<span class="ce-lbl">Layers</span></button>
      <button type="button" id="ce-preview" class="ce-chip" aria-pressed="false" aria-label="Preview">${I.eye}<span class="ce-lbl">Preview</span></button>
      <button type="button" id="ce-export" class="ce-chip" aria-label="Download preview" disabled>${I.download}<span class="ce-lbl">Download</span></button>
      </div></details>
        <button type="button" id="ce-publish" class="ce-primary" disabled>Next</button>
    </div>
  </header>
  ${renderExitDialog()}
  <div class="ce-body">
    <div class="ce-stage-wrap">
      <div class="ce-stage"><canvas id="ce-canvas" width="1080" height="1920" aria-label="Editing canvas"></canvas>
        ${isV2 ? `${renderSoundPicker(I)}` : ""}
        <div id="ce-trash" class="ce-trash" aria-label="Drop here to delete">${I.trash}</div>
        <div id="ce-safe-guides" class="ce-safe-guides" aria-hidden="true"></div>
        <div id="ce-inline-text" class="ce-inline-text" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Text on media" spellcheck="false" hidden></div>
        <button type="button" id="ce-text-done" class="ce-primary ce-text-done" hidden>Done</button>
        <p id="ce-empty" class="ce-empty"${hasSource ? " hidden" : ""}><span class="ce-empty-mark" aria-hidden="true"></span><strong>Start with a solid color.</strong><span>Add text, a photo, or a moving moment.</span></p>
        <div class="ce-messages"><p id="ce-status" class="ce-status" role="status"></p>
        <p id="ce-error" class="ce-error" role="alert"></p>
        <p id="ce-audio-warning" class="ce-details-status" role="status" hidden></p></div>
        ${v2Caption}
        <div class="ce-video-context" aria-label="Quick video edits" hidden>
          <button type="button" class="ce-ctx" data-ce-media-tool="trim" aria-label="Trim video">${I.scissors}<span>Trim</span></button>
          <button type="button" class="ce-ctx" data-ce-quick-split aria-label="Split at playhead">${I.split}<span>Split</span></button>
          <button type="button" class="ce-ctx" data-ce-media-tool="speed" aria-label="Speed">${I.speed}<span>Speed</span></button>
          <div id="ce-clip-list" class="ce-clip-list" data-ce-advanced-only role="list" aria-label="Clips"></div>
        </div>
      </div>
      ${v2Rail}
      <div class="ce-transport">
        <button type="button" id="ce-play" class="ce-icon-btn ce-dark" aria-label="Play or pause">${I.play}</button>
        <div class="ce-timeline"><div id="ce-filmstrip" class="ce-filmstrip" aria-hidden="true"></div><input id="ce-scrub" type="range" min="0" max="1" step="0.01" value="0" aria-label="Scrub timeline"><button id="ce-trim-handle-start" class="ce-trim-handle" type="button" aria-label="Drag clip start" hidden></button><button id="ce-trim-handle-end" class="ce-trim-handle" type="button" aria-label="Drag clip end" hidden></button></div>
        <span id="ce-time" class="ce-time">0:00</span>
      </div>
    </div>
    <div id="ce-camera-bar" class="ce-camera-bar">
      <div id="ce-camera-strip" class="ce-camera-strip"></div>
      <div class="ce-capture-row">
        <div id="ce-camera-gallery-slot" class="ce-camera-gallery-slot"></div>
        <button type="button" id="ce-flip" class="ce-capture-action" aria-label="Flip camera" hidden>${I.flip}<span>Flip</span></button>
        <div class="ce-shutter-control">
          <button type="button" id="ce-shutter" class="ce-shutter" aria-label="Take photo" aria-description="Tap to take a photo. Press and hold to switch to video." disabled><span aria-hidden="true"></span></button>
          <span>Shutter</span>
        </div>
        <button type="button" id="ce-flash" class="ce-capture-action" aria-pressed="false" aria-label="Flash" disabled>${I.flash}<span>Flash</span></button>
      </div>
      <span id="ce-capture-label" class="ce-capture-label ce-sr" aria-live="polite">Photo</span>
      <div class="ce-capture-modes" hidden>
        <button type="button" id="ce-photo" class="ce-camera-mode" aria-pressed="true">Photo</button>
        <button type="button" id="ce-record" class="ce-camera-mode" aria-pressed="false">Video</button>
      </div>
      <div id="ce-capture-picker" class="ce-capture-picker" role="tablist" aria-label="Capture mode" hidden>
        ${[["photo","Photo"],["video","Video"]].map(([mode,label])=>`<button type="button" role="tab" data-ce-capture-mode="${mode}" aria-selected="${mode==="photo"}">${label}</button>`).join("")}
      </div>
    </div>
    ${sheets.media}
    <div class="ce-dock">
      <div class="ce-dock-row ce-main-tools" role="toolbar" aria-label="Edit tools">
        <details class="ce-menu ce-quick" name="ce-menu"><summary>${I.draw}<span>Edit</span>${I.chev}</summary>
          <div class="ce-menu-pop">
            <button type="button" class="ce-tool" data-ce-add="text" aria-label="Add Text">${I.text}<span>Text</span></button>
            <button type="button" class="ce-tool" data-ce-media-tool="color" aria-label="Color">${I.color}<span>Color</span></button>
            <button type="button" id="ce-draw" class="ce-tool" aria-pressed="false">${I.draw}<span>Draw</span></button>
          </div>
        </details>
        <label for="ce-upload" class="ce-tool ce-upload-tool">${I.upload}<span>Upload</span></label>
        <div class="ce-more">
          <details class="ce-menu ce-browse-menu" name="ce-menu" data-ce-advanced-only><summary>${I.layers}<span>Add layers</span>${I.chev}</summary>
          <div class="ce-row ce-tools ce-menu-pop" role="toolbar" aria-label="Add layers">
            ${tool("emoji", responseStudio ? "Sticker" : "Emoji", responseStudio ? I.sticker : I.emoji)}${tool("image", "Image", I.image)}${tool("drawing", "Drawing", I.draw)}${tool("comment", "Comment", I.text)}
            <input id="ce-image-upload" type="file" accept="image/*" hidden aria-label="Add image or GIF layer">
          </div>
          </details>
        </div>
        <details class="ce-menu ce-share-menu" name="ce-menu"><summary>${I.share}<span aria-label="Share options">Options</span>${I.chev}</summary>
          <div class="ce-menu-pop ce-section-pop">
        <div class="ce-section-bar"><button data-ce-advanced-only type="button" id="ce-source-toggle" class="ce-chip" aria-expanded="false">Source</button><button data-ce-advanced-only type="button" id="ce-style-toggle" class="ce-chip" aria-expanded="false">Style</button><button type="button" id="ce-share-toggle" class="ce-chip" aria-expanded="false">Caption &amp; place</button></div>
          </div>
        </details>
      </div>
    </div>
    <div id="ce-media-share-destinations" class="ce-media-share-destinations" aria-label="Share destination">
      ${legacyDestinations}
      <div id="ce-feed-privacy" class="ce-feed-privacy" role="group" aria-label="Feed audience">
        <button type="button" data-ce-feed-visibility="public" aria-pressed="true">${isV2 ? "Everyone" : "Public"}</button>
        <button type="button" data-ce-feed-visibility="friends" aria-pressed="false">Friends only</button>
      </div>
    </div>
    ${v2Footer}
    ${v2TextBar}
    ${sheets.panel}
  </div>
</section>`;
}
