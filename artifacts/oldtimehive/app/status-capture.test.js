import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { statusAudiences, defaultAudience, recorderMime, mediaKind, friendlyError, STATUS_FONTS } from "./status-capture.js";

const source = readFileSync(new URL("./status-capture.js", import.meta.url), "utf8");

test("private accounts cannot pick Everyone and default to close friends", () => {
  assert.deepEqual(statusAudiences(true).map(o => [o.value, o.allowed]), [["public", false], ["close-friends", true]]);
  assert.equal(defaultAudience(true, "public"), "close-friends");
  assert.equal(defaultAudience(true), "close-friends");
  assert.equal(defaultAudience(false), "public");
  assert.equal(defaultAudience(false, "close-friends"), "close-friends");
});

test("recorder mime picks first supported type", () => {
  assert.equal(recorderMime(t => t === "video/webm"), "video/webm");
  assert.equal(recorderMime(() => false), "");
});

test("media kind detection", () => {
  assert.equal(mediaKind({ type: "video/mp4" }), "video");
  assert.equal(mediaKind({ type: "image/png" }), "image");
  assert.equal(mediaKind({ type: "text/plain" }), "");
});

test("errors shown to users are friendly, raw text only to console", () => {
  const orig = console.error; console.error = () => {};
  try {
    assert.match(friendlyError({ name: "NotAllowedError" }), /gallery/);
    assert.equal(friendlyError(new Error("TypeError xyz stack"), "Fallback"), "Fallback");
  } finally { console.error = orig; }
});

test("uses existing renderer/export/emoji/story APIs and a single send action", () => {
  for (const needle of ["createProject", "createLayer", "CreativeAssets", "drawProject", "canvasBlob", "exportCreativeVideo", "openEmojiPicker", "createCloudStory", "mediaBlob", "syncCloudPrivacy"]) {
    assert.ok(source.includes(needle), needle);
  }
  assert.equal((source.match(/Send to Status<\/button>/g) || []).length, 1);
  assert.ok(!/localStorage|indexedDB/.test(source), "no fake draft storage");
  assert.ok(source.includes("URL.revokeObjectURL"));
  assert.ok(source.includes("getTracks()"));
  assert.ok(/audio: false/.test(source), "camera opens without mic");
  assert.deepEqual(STATUS_FONTS, ["Manrope", "Georgia", "system-ui", "monospace"]);
});

test("gallery source opens the native picker before any await", () => {
  const body = source.slice(source.indexOf("export function openStatusCapture"));
  const click = body.indexOf("fileInput.click()"), firstAwait = body.indexOf("await ");
  assert.ok(click > 0 && click < firstAwait);
});

import { seedProject, normalizeSeedKind } from "./status-capture.js";

test("seed kinds map photo/video onto renderer kinds", () => {
  assert.equal(normalizeSeedKind("photo"), "image");
  assert.equal(normalizeSeedKind("video"), "video");
  assert.equal(normalizeSeedKind("", "x.webm"), "video");
});

test("seedProject keeps one project with a single background and no pages", () => {
  const base = { width: 1080, height: 1920, duration: 5, background: { kind: "color", color: "#000", media: "" }, layers: [], audioTracks: [] };
  const initialProject = { ...base, background: { kind: "photo", media: "oldtime-media:abc", color: "#111" },
    layers: [{ id: "t", kind: "text", text: "Hi", startTime: 2, endTime: 3 }], pages: [{ layers: [] }] };
  const p = seedProject(structuredClone(base), { initialProject });
  assert.equal(p.pages, undefined);
  assert.equal(p.background.kind, "image");
  assert.equal(p.background.media, "oldtime-media:abc");
  assert.equal(p.layers[0].text, "Hi");
  assert.equal(p.layers[0].startTime, 0);
  assert.notEqual(initialProject.layers[0].startTime, 0, "caller project untouched");
  const b = seedProject(structuredClone(base), { background: { media: "blob:x", kind: "video" } });
  assert.deepEqual([b.background.kind, b.background.media], ["video", "blob:x"]);
});

test("hold-release cancels a pending mic request (no ghost recording)", () => {
  assert.match(source, /if \(recordPending\) \{ recordToken\+\+/);
  assert.match(source, /token !== recordToken/);
  assert.ok(!/frameRate:\s*60/.test(source), "never claims 60fps");
});

import { statusTextStyle, fitTextLayout, STATUS_TEXT_STYLES } from "./status-capture.js";
const css = readFileSync(new URL("./status-capture.css", import.meta.url), "utf8");

test("only Classic/Plain/Box presets, always centered without transforms", () => {
  assert.deepEqual(STATUS_TEXT_STYLES, ["classic", "plain", "box"]);
  for (const s of STATUS_TEXT_STYLES) {
    const v = statusTextStyle(s);
    assert.deepEqual([v.x, v.y, v.scale, v.rotation, v.align], [.5, .5, 1, 0, "center"]);
  }
  assert.equal(statusTextStyle("box").backgroundOn, true);
  assert.equal(statusTextStyle("plain").shadow, false);
  assert.notEqual(statusTextStyle("box", "#17191c", "#17191c").color, "#17191c", "box text stays readable");
});

test("auto-size shrinks long text to fit and stays centered", () => {
  const ctx = { font: "", measureText: t => ({ width: t.length * (parseInt(/(\d+)px/.exec(ctx.font)[1]) * .55) }) };
  const textStyle = l => ({ font: `600 ${l.fontSize}px x`, lineHeight: l.fontSize * 1.35, text: l.text, family: "x" });
  const wrapLines = (c, text, width) => { const out = []; let line = ""; for (const w of text.split(" ")) { const n = line ? line + " " + w : w; if (c.measureText(n).width > width && line) { out.push(line); line = w; } else line = n; } out.push(line); return out; };
  const short = fitTextLayout(ctx, { textStyle, wrapLines }, { text: "Hi" }, true);
  const long = fitTextLayout(ctx, { textStyle, wrapLines }, { text: "word ".repeat(300).trim() }, true);
  assert.ok(short.fontSize > long.fontSize);
  assert.ok(long.fontSize >= 26);
  assert.deepEqual([long.x, long.y, long.rotation, long.scale], [.5, .5, 0, 1]);
  const box = fitTextLayout(ctx, { textStyle, wrapLines }, { text: "Hi", backgroundOn: true }, false);
  assert.ok(box.width < 920, "box hugs short text");
});

test("no selection box, handles, dragging, pinch, rotation or trash", () => {
  assert.match(source, /video\.currentTime : 0, null, \{ preview: true \}/);
  for (const banned of ["sc-trash", "touchstart", "\"wheel\"", "localPoint", "data-ed=\"font\"", "data-ed=\"style\"", "data-ed=\"bubble\""]) assert.ok(!source.includes(banned), banned);
  assert.ok(!css.includes("sc-trash"));
  assert.match(css, /sc-typing .sc-edit-top/);
  assert.match(source, /seq !== openSeq/, "stale opens can't stack controls");
});
