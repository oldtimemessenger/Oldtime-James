import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = f => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
const editor = read("creative-editor.js"), view = read("creative-editor-view.js");

test("Next opens the details step and does not publish", () => {
  assert.match(editor, /q\("publish"\)\.onclick=\(\)=>\{[^}]*detailsOpen=true;q\("details"\)\.hidden=false/s);
  assert.match(editor, /q\("details-publish"\)\.onclick=\(\)=>\{\s*if\(busy\)return;\s*const audioSession = projectOutputKind\(project, assets\) === "video"\s*\? createVideoAudioSession\(creativeAudioContextFor\(backgroundVideo\(\)\)\) : null;\s*error\(""\);void doPublish\(audioSession\);\s*\}/);
});
test("details back keeps the composition and closes only the step", () => {
  assert.match(editor, /closeDetails=\(\)=>\{detailsOpen=false;q\("details"\)\.hidden=true/);
  assert.doesNotMatch(editor.match(/closeDetails=\(\)=>\{[^}]*\}/)[0], /replaceProject|project\./);
});
test("audience buttons set visibility only; close-friends is kept", () => {
  const handler = editor.match(/\[data-ce-audience\]"\)\.forEach\(button=>button\.onclick[\s\S]*?\}\);/)[0];
  assert.match(handler, /q\("visibility"\)\.value=/);
  assert.doesNotMatch(handler, /doPublish|publish\(\)/);
  assert.match(view, /data-ce-audience="close-friends"/);
  assert.match(view, /data-ce-audience="connections"/);
  assert.match(view, /data-ce-audience="public"/);
});
test("progress and retry are surfaced in the details step", () => {
  assert.match(editor, /const status = value =>/);
  assert.match(editor, /Retry publish/);
  assert.match(editor, /Publishing…/);
  assert.match(view, /id="ce-details-status" class="ce-details-status" role="status"/);
});
test("publish passes its tap-started audio session to video rendering", () => {
  assert.match(editor, /audioSession: videoAudioSession,\s*audioTracks: await exportAudioTracks\(storyProject\)/);
  assert.match(editor, /const audioSession = projectOutputKind\(project, assets\) === "video"\s*\? createVideoAudioSession\(creativeAudioContextFor\(backgroundVideo\(\)\)\) : null;\s*error\(""\);void doPublish\(audioSession\)/);
});
test("photo upload status does not claim it is a video", () => {
  assert.match(editor, /const videoUpload = String\(blob\.type \|\| ""\)\.toLowerCase\(\)\.startsWith\("video\/"\)/);
  assert.match(editor, /videoUpload \? "Verifying uploaded video…" : "Verifying uploaded photo…"/);
  assert.match(editor, /videoUpload \? "Video upload verified…" : "Photo upload verified…"/);
});
test("inline text stays on canvas with Done reachable", () => {
  const inline = read("creative-inline-text.js");
  assert.match(inline, /contenteditable|input\.focus/);
  assert.match(view, /id="ce-text-done"/);
  assert.match(read("creative-overlay.js"), /editor\.append\(q\("text-done"\)\)/);
});
