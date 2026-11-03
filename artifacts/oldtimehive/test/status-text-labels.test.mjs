import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_TEXT_LABELS, textLabels, canAddLabel, emptyDraft, placementPoint, pointInLabel, hitTextLabel, joinLabelText } from "../app/status-text-labels.js";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const label = (o = {}) => ({ kind: "text", statusLabel: true, text: "Hello", x: .5, y: .5, scale: 1, rotation: 0, fontSize: 64, width: 920, ...o });

test("bounded labels, empty draft reuse, clamped placement", () => {
  assert.equal(MAX_TEXT_LABELS, 12);
  const many = Array.from({ length: 12 }, () => label());
  assert.equal(canAddLabel(many), false); assert.equal(canAddLabel(many.slice(1)), true);
  const draft = label({ text: "  " });
  assert.equal(emptyDraft([label(), draft]), draft);
  assert.deepEqual(placementPoint({ x: -1, y: 2 }), { x: .06, y: .94 });
  assert.equal(textLabels([label(), { kind: "text" }, { kind: "image" }]).length, 1);
});

test("topmost hit across all labels, scale and aspect-aware rotation", () => {
  const W = 1080, H = 1920;
  const a = label({ x: .3, y: .3 }), b = label({ x: .3, y: .3, text: "Top" }), c = label({ x: .7, y: .8 });
  assert.equal(hitTextLabel([a, b, c], .3, .3, W, H), b);
  assert.equal(hitTextLabel([a, b, c], .7, .8, W, H), c);
  assert.equal(hitTextLabel([a, b, c], .5, .55, W, H), null);
  assert.equal(hitTextLabel([label({ text: "" })], .5, .5, W, H), null, "empty drafts are not hit targets");
  const wide = label({ text: "a long horizontal label" });
  assert.equal(pointInLabel(wide, .5 + 300 / W, .5, W, H), true);
  wide.rotation = 90;
  assert.equal(pointInLabel(wide, .5 + 300 / W, .5, W, H), false);
  assert.equal(pointInLabel(wide, .5, .5 + 300 / H, W, H), true);
  const big = label({ scale: 3 });
  assert.equal(pointInLabel(big, .5 + 250 / W, .5, W, H), true);
});

test("story body joins non-empty labels within the caption limit", () => {
  assert.equal(joinLabelText([label({ text: "One" }), label({ text: " " }), label({ text: "Two" }), { kind: "text", text: "legacy" }], "Shared"), "Shared\nOne\nTwo");
  assert.equal(joinLabelText([label({ text: "x".repeat(1200) }), label({ text: "y".repeat(1200) })]).length, 2000);
});

test("editor wiring: tap places, tap edits topmost, drags never open keyboard, style on active only", () => {
  const src = read("../app/status-capture.js");
  assert.match(src, /openTextEditor\(\{ point: p \}\); \/\/ tap anywhere places a new label there/);
  assert.match(src, /if \(label\) \{ openTextEditor\(\{ layer: label \}\); return; \}/);
  assert.match(src, /act === "text"\) openTextEditor\(\{ fresh: true \}\)/);
  assert.match(src, /if \(suppressClick\) \{ suppressClick = false; return; \}/);
  assert.match(src, /const textHit = p => hitTextLabel\(project\.layers/);
  assert.match(src, /Object\.assign\(layer, place\);/, "style keeps placement");
  assert.match(src, /text: joinLabelText\(project\.layers, shareText\)/);
  assert.match(src, /statusLabel: true/);
});
