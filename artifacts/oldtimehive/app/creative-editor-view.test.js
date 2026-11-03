import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { renderCreativeEditor } from "./creative-editor-view.js";

const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);

test("both editor shells expose a hidden, accessible audio warning without changing the design", () => {
  for (const editorVersion of ["legacy", "v2"]) {
    assert.match(renderCreativeEditor({ editorVersion }), /id="ce-audio-warning"[^>]*role="status"[^>]*hidden/);
  }
  const source = readFileSync(new URL("./creative-editor.js", import.meta.url), "utf8");
  assert.match(source, /onWarning: warnAudio/);
  assert.match(source, /warnings: \[\.\.\.audioWarnings\]/);
  assert.match(source, /Posted.*original sound couldn’t be included/s);
});

test("editor view keeps its camera controls but exposes no draft action", () => {
  const html = renderCreativeEditor(), foundIds = ids(html);
  assert.equal(foundIds.length, new Set(foundIds).size);
  for (const id of ["ce-shutter", "ce-photo", "ce-record", "ce-flash", "ce-camera-gallery-slot", "ce-publish", "ce-upload"]) {
    assert.ok(foundIds.includes(id), id);
  }
  for (const destination of ["feed", "story", "close-friends"]) {
    assert.match(html, new RegExp(`data-ce-share-destination="${destination}"`));
  }
  assert.doesNotMatch(html, /is-create-v2|data-ce-rail=|id="ce-next-action"/);
  assert.doesNotMatch(html, /Filters|ce-filter-button|ce-crop-overlay|Crop \/ Reframe/i);
  assert.doesNotMatch(html, /ce-save-exit|ce-exit-save|Save &amp; Exit|draft restored/i);
});

test("Comment Remix exposes destination, audience, layer controls in their own safe-area rows", () => {
  const html = renderCreativeEditor({ responseStudio: true, hasSource: true });
  const foundIds = ids(html);
  assert.equal(foundIds.length, new Set(foundIds).size);
  assert.match(html, /class="creative-editor is-basic is-response-studio has-source/);
  for (const destination of ["feed", "story", "close-friends"]) {
    assert.match(html, new RegExp(`data-ce-share-destination="${destination}"`));
  }
  for (const audience of ["public", "friends"]) assert.match(html, new RegExp(`data-ce-feed-visibility="${audience}"`));
  for (const tool of ["Sticker", "Image", "Drawing"]) assert.match(html, new RegExp(`>${tool}<\\/span>`));
  const css = readFileSync(new URL("./creative-editor.css", import.meta.url), "utf8");
  assert.match(css, /\.creative-editor\.is-response-studio \.ce-media-share-destinations\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.creative-editor\.is-response-studio \.ce-feed-privacy\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.creative-editor\.is-response-studio \.ce-dock\s*\{[^}]*order:\s*5/s);
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  assert.match(app, /openCreativeEditor\(\{ postId, commentId, destination, startCamera, responseStudio: true/);
});

test("v2 Create renders the dedicated studio shell, not the legacy dock", () => {
  const html = renderCreativeEditor({ editorVersion: "v2" }), foundIds = ids(html);
  assert.equal(foundIds.length, new Set(foundIds).size);
  assert.match(html, /class="creative-editor cs-studio is-create-v2/);
  for (const hook of ["cs-top", "cs-rail", "cs-capture", "cs-textbar", "cs-details", "cs-edit-foot"]) assert.match(html, new RegExp(`class="[^"]*${hook}`));
  assert.doesNotMatch(html, /ce-dock|ce-head"|is-basic|ce-bottom-actions|ce-media-destination-row/);
  for (const tool of ["text", "templates", "sound", "draw", "overlay", "remove-bg", "canvas-color"]) assert.match(html, new RegExp(`data-ce-rail="${tool}"`));
  assert.match(html, /id="ce-refine-mask"/);
  assert.doesNotMatch(html, /Stickers|data-ce-rail="stickers"|ce-sticker-flow/);
  assert.match(html, /data-ce-rail="adjust"/);
  assert.equal((html.match(/data-ce-media-tool="trim"/g) || []).length >= 1, true);
  assert.match(html, /class="[^"]*ce-video-context[^"]*"[^>]*hidden/);
  for (const id of ["ce-undo", "ce-redo", "ce-sound-chip", "ce-sound-upload", "ce-shutter", "ce-flip", "ce-flash", "ce-camera-gallery-slot", "ce-upload", "ce-image-upload", "ce-remove-bg"].filter(i => i !== "ce-remove-bg")) assert.ok(foundIds.includes(id), id);
  assert.match(html, /id="ce-next-action"[^>]*aria-label="Next"/);
  assert.match(html, /id="ce-details-publish"[^>]*>Publish/);
  assert.match(html, /data-ce-audience="connections"[^>]*>.*?Friends only/s);
  assert.match(html, /data-ce-audience="close-friends"[^>]*>.*?Close Friends/s);
  assert.match(html, /<option value="story"/);
  // The latest studio request supersedes the old "no Filters" rule: Filters is now a bottom tool sheet.
  assert.doesNotMatch(html, /ce-filter-button|ce-crop-overlay|Crop \/ Reframe|draft restored/i);
  for (const tool of ["edit", "audio", "text", "overlay", "filters", "adjust", "canvas"]) assert.match(html, new RegExp(`data-cs-tool="${tool}"`));
  for (const lane of ["media", "text", "overlay", "audio"]) assert.match(html, new RegExp(`data-lane="${lane}"`));
  assert.match(html, /id="ce-studio-publish"[^>]*>Publish/);
  assert.match(html, /id="ce-ws-sheet"[^>]*role="dialog"/);
  assert.doesNotMatch(html, /<details[^>]*cs-tool|data-ce-add="sticker"/);
});

test("Create rail has no translucent tray behind its tool buttons",()=>{
  const css=readFileSync(new URL("./create-studio.css",import.meta.url),"utf8");
  const rail=css.match(/\.cs-studio \.cs-rail\s*\{([^}]*)\}/)?.[1]||"";
  assert.match(rail,/background:transparent/);
  assert.match(rail,/backdrop-filter:none/);
  assert.doesNotMatch(rail,/var\(--cs-glass\)|border-radius|border:1px/);
  const buttons=css.match(/\.cs-studio \.cs-rail-btn\s*\{([^}]*)\}/)?.[1]||"";
  assert.match(buttons,/background:transparent/);
  assert.match(buttons,/border:0/);
  assert.doesNotMatch(buttons,/backdrop-filter|rgba\(/);
});

test("edit rail is icon-only and sound choices are trending or private saves", () => {
  const html = renderCreativeEditor({ editorVersion: "v2" });
  const rail = html.match(/<nav class="cs-rail cs-edit-only"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || "";
  for (const label of ["Text", "Styles", "Draw", "Overlay", "Remove BG", "Adjust", "Canvas"]) {
    assert.match(rail, new RegExp(`aria-label="${label}"`));
    assert.doesNotMatch(rail, new RegExp(`<span>${label}<\\/span>`));
  }
  assert.match(rail, /aria-label="Choose sound"/);
  assert.match(rail, /id="ce-sound-title" class="ce-sr"/);
  assert.match(html, /data-sound-mode="trending"[^>]*>Trending/);
  assert.match(html, /data-sound-mode="saved"[^>]*>Saved/);
  assert.doesNotMatch(html, /ce-sound-search|Search sounds|data-sound-mode="library"|Choose audio from your library/);
  assert.match(html, /Choose audio from this device/);
});

test("capture reference: preview chrome, tabs above dock, trending picker, restart", () => {
  const html = renderCreativeEditor({ editorVersion: "v2" });
  assert.match(html, /<summary class="cs-title"[^>]*>New post<\/summary>/);
  assert.doesNotMatch(html,/class="ce-camera-settings|class="ce-camera-bar|class="ce-capture-row|class="ce-stage-wrap/);
  const stage = html.slice(html.indexOf('class="ce-stage cs-stage"'), html.indexOf('class="ce-video-context'));
  assert.match(stage, /id="ce-flash"/); assert.match(stage, /id="ce-flip"/); assert.match(stage, /cs-grid/); assert.match(stage, /id="ce-recording-indicator"/);
  assert.ok(html.indexOf('id="ce-capture-picker"') < html.indexOf('id="ce-shutter"'));
  assert.match(html, /id="ce-camera-reset"[^>]*aria-label="Restart camera"/);
  assert.match(html, /id="ce-upload" type="file" accept="image\/\*,video\/\*"/);
  assert.doesNotMatch(html, /gallery-glyph/);
});

test("text strip exposes real presets, fonts, custom color and size", () => {
  const html = renderCreativeEditor({ editorVersion: "v2" });
  for (const preset of ["plain", "editorial", "neon", "outline", "echo", "chrome", "gold", "extruded"]) {
    assert.match(html, new RegExp(`data-cs-preset="${preset}"`));
    assert.match(html, new RegExp(`data-ce-text-preset="${preset}"`));
  }
  assert.match(html, /<input type="color" id="ce-text-custom"/);
  assert.match(html, /id="ce-text-size" type="range"/);
  assert.match(html, /id="ce-text-fonts"/);
  assert.match(html, /id="ce-text-bar"[^>]*hidden/);
});

test("every control id the engine looks up exists in the v2 studio", () => {
  const source = readFileSync(new URL("./creative-editor.js", import.meta.url), "utf8");
  const wanted = new Set([...source.matchAll(/\bq\("([a-z0-9-]+)"\)/g)].map(m => m[1]));
  const html = renderCreativeEditor({ editorVersion: "v2", destination: "post" }), have = new Set(ids(html));
  const missing = [...wanted].filter(id => !have.has(`ce-${id}`) && !["save-exit", "save-hint", "media-share-destinations"].includes(id));
  assert.deepEqual(missing, []);
});

test("Story studio shows Story audiences and hides Feed audiences until selected", () => {
  const html = renderCreativeEditor({ editorVersion: "v2", destination: "story" });
  assert.match(html, /data-ce-audience="story"/);
  assert.match(html, /data-ce-audience="close-friends"/);
  assert.match(html, /id="ce-feed-audience"[^>]*hidden/);
  assert.match(html, /id="ce-story-audience"/);
  assert.doesNotMatch(html, /id="ce-story-audience"[^>]*hidden/);
});
