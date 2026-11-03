import test from "node:test";
import assert from "node:assert/strict";
test("overlay availability treats the remaining slots as a count, including on plain backgrounds", () => {
  const source = readFileSync(new URL("../app/status-capture.js", import.meta.url), "utf8");
  assert.match(source, /const full = overlaySlots\(project\?\.layers\) === 0/);
  assert.doesNotMatch(source, /overlaySlots\([^)]*\)\.length/);
  assert.doesNotMatch(source, /isText\s*\?\s*""\s*:\s*`<button[^`]+data-ed="overlay"/);
  assert.match(source, /l\.kind === "image" && l\.media/);
});
import { readFileSync } from "node:fs";
import { MAX_OVERLAYS, OVERLAY_ACCEPT, isOverlayFile, overlaySlots, overlaySize, overlayPosition, pointInOverlay, hitOverlay, scaleOverlay, overlayInsertIndex } from "../app/status-overlay.js";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const layer = (o = {}) => ({ id: Math.random().toString(36), kind: "image", statusOverlay: true, x: .5, y: .5, width: 200, height: 100, scale: 1, rotation: 0, ...o });

test("overlay files, limits and aspect-kept sizing", () => {
  assert.equal(OVERLAY_ACCEPT, "image/jpeg,image/png,image/webp");
  assert.equal(isOverlayFile({ type: "image/png" }), true);
  assert.equal(isOverlayFile({ type: "video/mp4" }), false);
  assert.equal(isOverlayFile({ type: "image/gif" }), false);
  assert.equal(MAX_OVERLAYS, 6);
  assert.equal(overlaySlots([layer(), layer(), { kind: "image" }, { kind: "text" }]), 4, "only overlay pictures count");
  const s = overlaySize(4000, 3000, 1080, 1920);
  assert.ok(Math.abs(s.width / s.height - 4 / 3) < .01); assert.ok(s.width <= 1080 * .55 + 1);
  const tall = overlaySize(1000, 4000, 1080, 1920);
  assert.ok(tall.height <= 1920 * .4 + 1); assert.ok(Math.abs(tall.width / tall.height - .25) < .01);
  assert.notDeepEqual(overlayPosition(0), overlayPosition(1));
});

test("transformed hit-test: scale, rotation, topmost", () => {
  const a = layer();
  assert.equal(pointInOverlay(a, .5 + 90 / 1080, .5, 1080, 1920), true);
  assert.equal(pointInOverlay(a, .5 + 150 / 1080, .5, 1080, 1920), false);
  scaleOverlay(a, 2);
  assert.equal(pointInOverlay(a, .5 + 150 / 1080, .5, 1080, 1920), true);
  const r = layer({ rotation: 90 });
  assert.equal(pointInOverlay(r, .5, .5 + 90 / 1920, 1080, 1920), true, "rotated width now vertical");
  const top = layer();
  assert.equal(hitOverlay([a, top, { kind: "text", x: .5, y: .5 }], .5, .5, 1080, 1920), top);
  assert.equal(hitOverlay([a], .05, .05, 1080, 1920), null);
  scaleOverlay(a, 100); assert.equal(a.scale, 4); scaleOverlay(a, .0001); assert.equal(a.scale, .2);
  assert.equal(overlayInsertIndex([{ kind: "image" }, { kind: "drawing" }, { kind: "text" }]), 1, "below drawing and Status text");
});

test("editor wiring: separate multi input, owned URLs, layers baked by drawProject, controls", () => {
  const src = read("../app/status-capture.js");
  assert.match(src, /overlayInput\.multiple = true/);
  assert.match(src, /overlayInput\.value = ""; \/\/ allow picking the same file again/);
  assert.match(src, /aria-label="Add picture overlay"/);
  assert.match(src, /const url = own\(file\);/);
  assert.match(src, /M\.createLayer\("image", \{ media: url, \.\.\.size, \.\.\.overlayPosition\(count\), endTime: 3600, statusOverlay: true \}\)/);
  assert.match(src, /failed\+\+; URL\.revokeObjectURL\(url\); owned\.delete\(url\);/, "decode failure keeps everything else");
  assert.match(src, /const o = hitOverlay\(project\.layers[^)]*\); if \(o\) return \{ type: "overlay", item: o \}/);
  assert.match(src, /o\.scale = Math\.min\(4, Math\.max\(\.2, start\.scale \* k\)\); o\.rotation = start\.rotation \+ rot;/);
  for (const a of ["ov-bigger", "ov-smaller", "ov-remove", "ov-done"]) assert.match(src, new RegExp(`data-ed="${a}"`));
  assert.doesNotMatch(src, /ov-edit|overlay.*title/i);
  assert.match(src, /fileInput\.remove\(\); overlayInput\.remove\(\);/);
});
