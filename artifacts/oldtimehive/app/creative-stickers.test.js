import test from "node:test";
import assert from "node:assert/strict";
import { drawSticker } from "./creative-stickers.js";
import { renderCreativeEditor } from "./creative-editor-view.js";

function mockContext() {
  const calls = [];
  const ctx = new Proxy({
    measureText: text => ({ width: String(text).length * 16 }),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    fillText: () => calls.push("fillText")
  }, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key === "string") return (...args) => calls.push(key);
      return undefined;
    },
    set(target, key, value) { target[key] = value; return true; }
  });
  return { ctx, calls };
}

test("each available sticker draws a real, measurable canvas layer", () => {
  const kinds = ["heart", "arrow", "circle", "rectangle", "star", "reaction", "location",
    "mention", "hashtag", "music", "question", "poll", "emoji", "custom-text"];
  for (const sticker of kinds) {
    const { ctx, calls } = mockContext();
    const bounds = drawSticker(ctx, { sticker, text: "A short prompt", choices: ["Yes", "No"] });
    assert.ok(bounds.width > 0 && bounds.height > 0, `${sticker} has bounds`);
    assert.ok(calls.includes("fill") || calls.includes("stroke") || calls.includes("fillText"), `${sticker} draws visible artwork`);
  }
});

test("legacy sticker artwork remains supported without a sticker authoring tool", () => {
  const html = renderCreativeEditor({ destination: "story" });
  assert.doesNotMatch(html, /ce-sticker-flow|data-ce-sticker=|data-ce-rail="stickers"|data-ce-add="sticker"/);
  const { ctx } = mockContext();
  assert.ok(drawSticker(ctx, { sticker: "heart" }).width > 0);
  assert.doesNotMatch(html, /hey-word|Hey Word/i);
});
