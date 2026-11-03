import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { releaseVideo, releasePostVideos, shouldReleaseVideo } from "../app/media-release.js";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");

function fakeVideo({ post = true, protectedBy = false, stream = null, src = "https://cdn/v.mp4" } = {}) {
  const attrs = new Map(src ? [["src", src]] : []);
  const v = { tagName: "VIDEO", srcObject: stream, calls: [],
    getAttribute: n => attrs.get(n) ?? null, removeAttribute: n => { attrs.delete(n); v.calls.push(`rm:${n}`); },
    closest: () => protectedBy ? {} : null, matches: () => post, querySelector: () => null, querySelectorAll: () => [],
    pause: () => v.calls.push("pause"), load: () => v.calls.push("load") };
  return v;
}

test("releases discarded post videos: pause, drop src, load", () => {
  const v = fakeVideo();
  assert.equal(releaseVideo(v), true);
  assert.deepEqual(v.calls, ["pause", "rm:src", "load"]);
  assert.equal(v.getAttribute("src"), null);
});

test("skips floating/protected, camera streams, non-post and empty videos", () => {
  for (const v of [fakeVideo({ protectedBy: true }), fakeVideo({ stream: {} }), fakeVideo({ post: false }), fakeVideo({ src: "" })]) {
    assert.equal(shouldReleaseVideo(v), false);
    assert.equal(releaseVideo(v), false);
    assert.deepEqual(v.calls, []);
  }
});

test("subtree release counts only eligible videos", () => {
  const vids = [fakeVideo(), fakeVideo({ protectedBy: true }), fakeVideo()];
  assert.equal(releasePostVideos({ tagName: "DIV", querySelectorAll: () => vids }), 2);
  assert.equal(releasePostVideos(null), 0);
});

test("source guards: shell releases outgoing screen, reconcile releases removed nodes, floating protected", () => {
  const app = read("../app/app.js"), keyed = read("../app/keyed-ui.js"), rel = read("../app/media-release.js");
  assert.match(app, /if \(previousScreen\) releasePostVideos\(previousScreen\);\n\s*app\.innerHTML = `<div class="stage">/);
  assert.match(keyed, /releasePostVideos\(cursor\); cursor\.remove\(\)/);
  assert.match(rel, /\.ot-video-float/);
  assert.doesNotMatch(rel, /document\.body/);
});

test("email manual action allows null; reminder card stays strict false", async () => {
  const { shouldShowEmailReminder } = await import("../app/email-verification-reminder.js");
  assert.equal(shouldShowEmailReminder({ accountId: "a", verified: null, accountJoinedAt: 1, state: { items: {} }, now: 1e13 }), false, "null never shows the Home card");
  const ui = read("../app/email-verification-ui.js"), app = read("../app/app.js");
  assert.match(ui, /verified === false \|\| verified === null/);
  assert.match(ui, /emailVerified === false/);
  assert.match(app, /emailManualActionAvailable\(\) \? `<button type="button" class="listbtn" data-ev-settings/);
  assert.doesNotMatch(app, /Not confirmed/);
});

test("settings art: no duplicate safety scene, close friends and fallbacks distinct", () => {
  const app = read("../app/app.js"), view = read("../app/help-prompt-view.js"), prompts = read("../app/help-prompts.js");
  assert.match(app, /security:"information","close-friends":"audience"/);
  assert.match(view, /\/notification\/i\.test\(hint\) \? "notifications\.webp"/);
  assert.doesNotMatch(prompts, /Compact camera|Metal key|photo journal|portrait frame/);
});
