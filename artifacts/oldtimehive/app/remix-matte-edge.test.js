import test from "node:test";
import assert from "node:assert/strict";
import { adjustCutoutEdges, matteDimensions } from "./remix-matte.js";

function withFakeCanvas(run) {
  const previousDocument = globalThis.document;
  const pixels = new Uint8ClampedArray([
    0, 0, 0, 0,
    0, 0, 0, 128,
    0, 0, 0, 255
  ]);
  let written;
  const context = {
    drawImage() {},
    getImageData() { return { data: new Uint8ClampedArray(pixels) }; },
    putImageData(image) { written = image.data; }
  };
  const canvas = { width: 0, height: 0, getContext: () => context };
  globalThis.document = { createElement: () => canvas };
  try { run({ canvas, getWritten: () => written }); }
  finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

test("automatic cutout edges remain unchanged until the creator adjusts them", () => {
  withFakeCanvas(({ canvas, getWritten }) => {
    const source = { width: 3, height: 1 };
    assert.equal(adjustCutoutEdges(source).width, 3);
    assert.equal(getWritten(), undefined);
    assert.equal(adjustCutoutEdges(source, 50).width, 3);
    assert.equal(getWritten()[7], 0, "positive edge shift tightens the matte");
    assert.equal(adjustCutoutEdges(source, -50).width, 3);
    assert.equal(getWritten()[7], 255, "negative edge shift expands the matte");
  });
});

test("still-image masks retain more edge detail while remaining bounded and never upscale", () => {
  assert.deepEqual(matteDimensions(4000, 2000, 1024), { width: 1024, height: 512 });
  assert.deepEqual(matteDimensions(800, 400, 1024), { width: 800, height: 400 });
  assert.deepEqual(matteDimensions(4000, 2000), { width: 640, height: 320 });
});
