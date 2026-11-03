import assert from "node:assert/strict";
import test from "node:test";
import { mapMaskPointer, maskViewTransform } from "./creative-mask-geometry.js";

test("mask preview fits the image without stretching and maps taps through letterboxing", () => {
  const rect = { left: 20, top: 40, width: 300, height: 200 };
  const image = { width: 1000, height: 500 };
  const view = maskViewTransform(rect, image);
  assert.deepEqual(view, { scale: 0.3, x: 0, y: 25 });
  assert.deepEqual(mapMaskPointer(170, 140, rect, image), { x: 500, y: 250 });
});

test("pinch-zoom transform maps the anchored image point back to its screen position", () => {
  const rect = { left: 30, top: 50, width: 320, height: 240 };
  const image = { width: 800, height: 600 };
  const zoom = 2.5, panX = 24, panY = -18;
  const view = maskViewTransform(rect, image, zoom, panX, panY);
  const clientX = rect.left + view.x + 280 * view.scale;
  const clientY = rect.top + view.y + 190 * view.scale;
  const result = mapMaskPointer(clientX, clientY, rect, image, zoom, panX, panY);
  assert.ok(Math.abs(result.x - 280) < 1e-8);
  assert.ok(Math.abs(result.y - 190) < 1e-8);
});
