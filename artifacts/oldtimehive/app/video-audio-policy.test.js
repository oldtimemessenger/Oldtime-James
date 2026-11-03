import test from "node:test";
import assert from "node:assert/strict";
import {exportAudioPlan, readVideoAudioPresence, setOriginalAudioMuted} from "./video-audio-policy.js";
import {audioStep, readyAudioContext, loadAudioBuffer} from "./audio-render-support.js";

test("silent, original, explicit mute and added music have distinct audio requirements", () => {
  const video = {muted: true}; // An autoplay preview flag is not an audio edit.
  assert.equal(exportAudioPlan({video, sourceHasAudio: false}).needsAudio, false);
  assert.equal(exportAudioPlan({video, sourceHasAudio: true}).original, true);
  assert.equal(exportAudioPlan({video, sourceHasAudio: null}).original, true);
  assert.equal(exportAudioPlan({video, background: {audioMuted: true}}).needsAudio, false);
  const mixed = exportAudioPlan({video, sourceHasAudio: false, audioTracks: [{media: "song", volume: .8}]});
  assert.equal(mixed.original, false);
  assert.equal(mixed.music.length, 1);
  assert.equal(mixed.needsAudio, true);
  assert.equal(exportAudioPlan({video, sourceHasAudio: false, audioTracks: [{media: "song", volume: 0}]}).needsAudio, false);
});
test("muting uploaded-video audio keeps separately added music in the export", () => {
  const background = {kind:"video"}, video = {muted:false};
  assert.equal(setOriginalAudioMuted(background, true, video), true);
  assert.equal(video.muted, true);
  const plan = exportAudioPlan({
    video, background, sourceHasAudio:true, audioTracks:[{media:"added-music",volume:.8}],
  });
  assert.equal(plan.original, false);
  assert.equal(plan.music.length, 1);
  assert.equal(plan.needsAudio, true);
  assert.equal(setOriginalAudioMuted(background, false, video), false);
  assert.equal(video.muted, false);
  assert.equal(exportAudioPlan({video, background, sourceHasAudio:true}).original, true);
});
function box(type, ...parts) {
  const data = Buffer.concat(parts), header = Buffer.alloc(8);
  header.writeUInt32BE(data.length + 8); header.write(type, 4);
  return Buffer.concat([header, data]);
}
function track(type) {
  const handler = Buffer.alloc(12); handler.write(type, 8);
  return box("trak", box("mdia", box("hdlr", handler)));
}
test("MP4 audio metadata distinguishes absent audio from unknown or damaged media", async () => {
  assert.equal(await readVideoAudioPresence(new Blob([box("moov", track("vide"))], {type:"video/mp4"})), false);
  assert.equal(await readVideoAudioPresence(new Blob([box("moov", track("vide"), track("soun"))], {type:"video/mp4"})), true);
  assert.equal(await readVideoAudioPresence(new Blob(["damaged"], {type:"video/mp4"})), null);
  assert.equal(await readVideoAudioPresence(new Blob(["unknown"], {type:"video/webm"})), null);
});
test("WebKit interrupted state is resumed and real native audio errors are preserved", async () => {
  const context = {state:"interrupted", async resume() {this.state="running";}};
  await readyAudioContext(context, null, 50);
  assert.equal(context.state, "running");
  const original = new DOMException("OS denied audio startup", "NotAllowedError");
  await assert.rejects(audioStep("resume", context, () => Promise.reject(original), 50), error =>
    error === original && error.name === "NotAllowedError" && error.publicationStage === "audio-resume");
});
test("failed sound download retains HTTP evidence without signed URL credentials", async () => {
  const fetchBefore = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{"error":"Sound not found"}', {status:404, headers:{"cf-ray":"fixture-ray"}});
    await assert.rejects(loadAudioBuffer({state:"running"}, "https://example.test/sound?token=private", 50),
      error => error.status === 404 && error.publicationStage === "audio-sound-load" &&
        error.request.url === "https://example.test/sound" && error.requestId === "fixture-ray" &&
        error.responseBody.includes("Sound not found"));
  } finally { globalThis.fetch = fetchBefore; }
});
