import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSticker, normalizeStickers, addSticker, canAddSticker, removeSticker, updateStickerText, resizeSticker, hitSticker, pointInSticker,
  pinchDelta, clampMediaTransform, publishStickers, stickerHitbox, isUuid, MAX_STICKERS, DEFAULT_PROMPTS, STICKER_CTA } from "../app/status-sticker-editor.js";
import { drawStatusStickers } from "../app/status-sticker-art.js";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const Q = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";

test("sticker metadata shape, defaults and limits", () => {
  const q = createSticker("questions");
  assert.ok(isUuid(q.id));
  assert.equal(q.prompt, "Ask me anything");
  assert.doesNotMatch(JSON.stringify(DEFAULT_PROMPTS), /Ask OldTime/i);
  assert.equal(STICKER_CTA, "Add your own");
  assert.deepEqual([q.x, q.y, q.width, q.rotation], [.5, .55, .7, 0]);
  updateStickerText(q, { title: "t".repeat(90), prompt: "p".repeat(200) });
  assert.equal(q.title.length, 60); assert.equal(q.prompt.length, 140);
  const a = createSticker("answer", { questionId: Q, answer: "x".repeat(700), prompt: "Ask me anything" });
  assert.equal(a.answer.length, 600); assert.equal(a.questionId, Q);
});

test("one of each kind, max 4, answer needs a questionId (seed fallback)", () => {
  const list = [];
  assert.ok(addSticker(list, "questions")); assert.equal(addSticker(list, "questions"), null);
  assert.ok(addSticker(list, "trendsetters")); assert.ok(addSticker(list, "hey-world"));
  assert.equal(canAddSticker(list, "answer"), false, "answer is never added from the picker");
  assert.equal(list.length, 3);
  const seeded = normalizeStickers([{ kind: "answer", prompt: "Ask me anything" }, { kind: "hey-world" }, { kind: "hey-world" }, { kind: "bogus" }], { answerQuestionId: Q });
  assert.deepEqual(seeded.map(s => s.kind), ["answer", "hey-world"]);
  assert.equal(seeded[0].questionId, Q);
  assert.equal(normalizeStickers([{ kind: "answer" }]).length, 0, "answer without question is dropped");
  assert.ok(normalizeStickers([{ kind: "questions" }, { kind: "trendsetters" }, { kind: "hey-world" }, { kind: "answer", questionId: Q }]).length <= MAX_STICKERS);
  assert.equal(removeSticker(list, list[0].id), true); assert.equal(list.length, 2);
});

test("normalized geometry: rotated hitbox, topmost hit, resize clamps, pinch math", () => {
  const s = createSticker("questions", { x: .5, y: .5, width: .6, height: .2 });
  assert.equal(pointInSticker(s, .5, .5), true);
  assert.equal(pointInSticker(s, .5, .65), false);
  s.rotation = 90;
  assert.equal(pointInSticker(s, .5, .65), true, "rotated box covers vertical extent");
  const top = createSticker("hey-world", { x: .5, y: .5 });
  assert.equal(hitSticker([s, top], .5, .5), top);
  resizeSticker(top, 10); assert.ok(top.width <= .96);
  resizeSticker(top, .01); assert.ok(top.width >= .28);
  const d = pinchDelta({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 3 });
  assert.equal(d.scale, 2); assert.equal(Math.round(d.rotation), 90);
  assert.deepEqual(clampMediaTransform({ x: 3, y: -3, scale: 9 }), { x: 1, y: -1, scale: 4 });
  assert.deepEqual(Object.keys(stickerHitbox(s)), ["id", "kind", "x", "y", "width", "height", "rotation"]);
});

test("publish payload keeps metadata only", () => {
  const out = publishStickers([{ kind: "questions", title: "Hi", selected: true }, { kind: "answer", questionId: Q, answer: "Yes" }]);
  assert.deepEqual(Object.keys(out[0]).sort(), ["height", "id", "kind", "prompt", "rotation", "title", "width", "x", "y"]);
  assert.equal(out[1].answer, "Yes"); assert.equal(out[1].questionId, Q);
});

test("drawStatusStickers bakes every kind into the canvas without throwing", async t => {
  const previous = globalThis.Image;
  globalThis.Image = class { naturalWidth = 900; set src(value) { queueMicrotask(() => this.onload?.()); } };
  t.after(() => { if (previous) globalThis.Image = previous; else delete globalThis.Image; });
  const { loadStickerArt } = await import("../app/status-sticker-art.js");
  await loadStickerArt();
  const calls = [];
  const ctx = new Proxy({ measureText: t => ({ width: String(t).length * 8 }), canvas: { width: 540, height: 960 } }, {
    get: (o, k) => k === "getContext" ? undefined : k in o ? o[k] : (...args) => calls.push(k), set: (o, k, v) => { o[k] = v; return true; } });
  const list = normalizeStickers([{ kind: "questions" }, { kind: "trendsetters" }, { kind: "hey-world" }, { kind: "answer", questionId: Q, answer: "Sure" }]);
  drawStatusStickers(ctx, list, 540, 960, { selectedId: list[0].id });
  assert.ok(calls.filter(c => c === "fillText").length >= 8);
  assert.ok(calls.includes("setTransform"));
});

test("editor wiring: seeds survive source choice, Fit/Fill, stickers in preview + exports + publish", () => {
  const src = read("../app/status-capture.js"), art = read("../app/status-sticker-art.js"), css = read("../app/status-capture.css");
  assert.match(src, /initialStickers = \[\], answerQuestionId = null/);
  assert.match(src, /project\.statusStickers = stickers;/);
  assert.match(src, /fit: "cover", statusTransform: \{ x: 0, y: 0, scale: 1 \}/);
  assert.match(src, /project\.background\.fit === "contain" \? "cover" : "contain"/);
  assert.ok(src.includes("render: (time, target) => { m.drawProject(target, project, assets, () => null, time, null, {}); drawStatusStickers(target, stickers, target.width, target.height); }"));
  assert.match(src, /drawStatusStickers\(out, stickers, out\.width, out\.height\)/);
  assert.match(src, /drawStatusStickers\(canvas, stickers, canvas\.width, canvas\.height, \{ selectedId: selectedStickerId \}\)/);
  assert.match(src, /createCloudStory\(\{ text: joinLabelText\(project\.layers, shareText\), visibility: audience, mediaBlob: blob, stickers: project\.statusStickers, answerQuestionId: seedQuestionId \}\)/);
  assert.match(src, /if \(suppressClick\) \{ suppressClick = false; return; \}/, "moved gesture never triggers click-edit");
  assert.match(src, /pointers\.size >= 2/);
  assert.match(art, /status-stickers\/trendsetters\.png/); assert.match(art, /status-stickers\/hey-world\.png/);
  for (const s of [src, art]) { assert.doesNotMatch(s, /Ask OldTime/i); assert.doesNotMatch(s, /\p{Extended_Pictographic}/u); }
  assert.match(art, /Add your own/); assert.match(art, /8e1b24/i);
  assert.match(css, /\.sc-stk-row\{[^}]*overflow-x:auto;scroll-snap-type:x mandatory/);
});

test("answer seed preserves a 300-char private question verbatim; regular prompt stays 140", async () => {
  const { ANSWER_PROMPT_MAX } = await import("../app/status-sticker-editor.js");
  const question = "Q".repeat(299) + "?";
  const [a] = normalizeStickers([{ kind: "answer", prompt: question, answer: "A".repeat(600), title: "T".repeat(80) }], { answerQuestionId: Q });
  assert.equal(ANSWER_PROMPT_MAX, 300);
  assert.equal(a.prompt, question); assert.equal(a.title.length, 60);
  updateStickerText(a, { prompt: "forged", answer: "edited", title: "Mine" });
  assert.equal(a.prompt, question, "answer prompt is read-only"); assert.equal(a.answer, "edited"); assert.equal(a.title, "Mine");
  const [out] = publishStickers([a]);
  assert.equal(out.prompt, question); assert.equal(out.questionId, Q);
  assert.equal(createSticker("questions", { prompt: "p".repeat(300) }).prompt.length, 140);
  const src = read("../app/status-capture.js");
  assert.match(src, /form\.elements\.prompt\.readOnly = answering/);
  assert.match(src, /prompt: s\.kind === "answer" \? undefined :/);
});

test("long answer card text is clipped inside the box", () => {
  const calls = [];
  const ctx = new Proxy({ measureText: t => ({ width: String(t).length * 7 }), canvas: { width: 540, height: 960 } }, {
    get: (o, k) => k === "getContext" ? undefined : k in o ? o[k] : (...args) => calls.push([k, args]), set: (o, k, v) => { o[k] = v; return true; } });
  const s = normalizeStickers([{ kind: "answer", questionId: Q, prompt: "word ".repeat(60).trim(), answer: "long ".repeat(120).trim() }]);
  drawStatusStickers(ctx, s, 540, 960);
  assert.ok(calls.some(([k]) => k === "clip"));
  const top = 960 * s[0].y - 960 * s[0].height / 2, bottom = 960 * s[0].y + 960 * s[0].height / 2;
  const texts = calls.filter(([k]) => k === "fillText").map(([, a]) => a[2]);
  assert.ok(texts.length > 2);
  for (const y of texts) assert.ok(y >= -960 * s[0].height / 2 - 1 && y <= 960 * s[0].height / 2, `text y ${y} within card (${top}-${bottom})`);
});

test("sharing an owner's question keeps the canonical text, grows the field, and omits asker identity", async () => {
  const { questionAnswerSeed, updateStickerText } = await import("../app/status-sticker-editor.js");
  const seed = questionAnswerSeed({ id:Q, body:"Where was this taken?", asker:{ username:"private_person" } }, "Your question");
  const answer = seed.initialStickers[0], before = answer.height;
  assert.equal(seed.answerQuestionId, Q);
  assert.equal(answer.prompt, "Where was this taken?");
  assert.ok(before > .4);
  updateStickerText(answer, { answer:"A longer response ".repeat(25) });
  assert.ok(answer.height > before);
  assert.ok(answer.height <= .78);
  assert.ok(!JSON.stringify(seed).includes("private_person"));
});

test("a missing original image prevents publishing a blank interactive sticker", async () => {
  const previous = globalThis.Image;
  globalThis.Image = class { set src(value) { queueMicrotask(() => this.onerror?.()); } };
  try {
    const painter = await import("../app/status-sticker-art.js?missing-art-test");
    await assert.rejects(painter.loadStickerArt(["answer"], { required:true }), /Couldn't load the sticker artwork/);
  } finally { globalThis.Image = previous; }
});
