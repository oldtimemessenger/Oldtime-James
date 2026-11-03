import test from "node:test";
import assert from "node:assert/strict";
import { createSearchPlaybackTracker, createInsightLoader, qualifyingWatchSeconds, normalizeSearchPhrase } from "./search-insights.js";
import { createExploreEcosystem } from "./explore-ecosystem.js";

function fakeVideo() {
  const target = new EventTarget();
  const video = Object.assign(target, { tagName: "VIDEO", paused: true, ended: false, seeking: false, readyState: 4, currentTime: 0, playbackRate: 1 });
  const feed = new EventTarget();
  feed.querySelectorAll = () => [video];
  // Media events do not bubble: emulate capture-phase delivery to the container.
  video.fire = (type, patch = {}) => {
    Object.assign(video, patch);
    const event = new Event(type);
    Object.defineProperty(event, "target", { value: video });
    feed.dispatchEvent(event);
  };
  video.feed = feed;
  video.play = (at = video.currentTime) => { video.fire("playing", { paused: false, currentTime: at }); };
  video.tick = seconds => video.fire("timeupdate", { currentTime: video.currentTime + seconds });
  return video;
}
const setup = (overrides = {}) => {
  const sent = [];
  let visible = true;
  const tracker = createSearchPlaybackTracker({ send: async payload => { sent.push(payload); return overrides.result; }, isVisible: () => visible });
  const video = fakeVideo();
  tracker.start("  Night   Skate ", "acct");
  const original = video.feed.addEventListener.bind(video.feed);
  const removed = [];
  video.feed.addEventListener = (type, fn, capture) => original(type, fn, capture);
  video.feed.removeEventListener = (type, fn, capture) => removed.push(type);
  const unbind = tracker.bind(video.feed, () => "v1");
  return { tracker, video, sent, unbind, removed, hide: () => { visible = false; }, show: () => { visible = true; } };
};
const playFor = (video, seconds, step = 0.5) => { for (let t = 0; t < seconds; t += step) video.tick(step); };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test("helpers normalize phrases and only qualify whole seconds above five", () => {
  assert.equal(normalizeSearchPhrase("  a   b "), "a b");
  assert.equal(qualifyingWatchSeconds(5), 0);
  assert.equal(qualifyingWatchSeconds(5.99), 0);
  assert.equal(qualifyingWatchSeconds(6), 6);
  assert.equal(qualifyingWatchSeconds(6.9), 6);
  assert.equal(qualifyingWatchSeconds(3601), 0);
  assert.equal(qualifyingWatchSeconds(NaN), 0);
});

test("submits once after more than five seconds of real playback with the original phrase", async () => {
  const f = setup();
  f.video.play(0);
  playFor(f.video, 5.5);
  await flush();
  assert.equal(f.sent.length, 0, "5.5s is not a whole second above five");
  playFor(f.video, 1);
  playFor(f.video, 10);
  await flush();
  assert.deepEqual(f.sent, [{ videoId: "v1", queryText: "Night Skate", watchTimeSeconds: 6 }]);
});

test("paused time, seeks and ended/emptied events never count", async () => {
  const f = setup();
  f.video.play(0);
  playFor(f.video, 3);
  f.video.fire("pause", { paused: true });
  for (let i = 0; i < 40; i++) f.video.fire("timeupdate", { currentTime: f.video.currentTime + 1 });
  f.video.fire("seeking", { seeking: true });
  f.video.fire("seeked", { seeking: false, currentTime: 100 });
  f.video.fire("timeupdate", { paused: false, currentTime: 200 });
  f.video.fire("timeupdate", { currentTime: 400 });
  await flush();
  assert.equal(f.sent.length, 0);
  assert.ok(f.tracker.watched("v1") < 4);
});

test("background playback does not count and resumes without the hidden gap", async () => {
  const f = setup();
  f.video.play(0);
  playFor(f.video, 4);
  f.hide();
  playFor(f.video, 30);
  await flush();
  assert.equal(f.sent.length, 0);
  f.show();
  f.video.play();
  playFor(f.video, 1.5);
  await flush();
  assert.equal(f.sent.length, 0, "4s + 1.5s is still not enough");
  playFor(f.video, 1);
  await flush();
  assert.equal(f.sent.length, 1);
});

test("duplicate events, rebinding and a failed request never cause a second submission", async () => {
  const sent = [];
  const tracker = createSearchPlaybackTracker({ send: async payload => { sent.push(payload); throw new Error("offline"); }, isVisible: () => true });
  tracker.start("skate", "acct");
  const video = fakeVideo();
  tracker.bind(video.feed, () => "v1");
  video.play(0);
  playFor(video, 20);
  await flush();
  tracker.start("SKATE", "acct"); // same session after navigation/restore
  tracker.bind(video.feed, () => "v1");
  video.play();
  playFor(video, 20);
  await flush();
  assert.equal(sent.length, 1);
});

test("a different phrase or account starts a new session; non-Search opens never track", async () => {
  const f = setup();
  f.video.play(0);
  playFor(f.video, 7);
  await flush();
  assert.equal(f.sent.length, 1);
  assert.equal(f.tracker.start("other phrase", "acct"), true);
  f.video.play(0);
  playFor(f.video, 7);
  await flush();
  assert.equal(f.sent.length, 2);
  assert.equal(f.sent[1].queryText, "other phrase");
  assert.equal(f.tracker.start("   ", "acct"), false);
  f.video.play(0);
  playFor(f.video, 20);
  await flush();
  assert.equal(f.sent.length, 2);
  const none = createSearchPlaybackTracker({ send: async payload => f.sent.push(payload), isVisible: () => true });
  const feedVideo = fakeVideo();
  none.bind(feedVideo.feed, () => "");
  feedVideo.play(0);
  playFor(feedVideo, 20);
  await flush();
  assert.equal(f.sent.length, 2);
});

test("unbinding removes every media listener", () => {
  const f = setup();
  f.unbind();
  assert.ok(f.removed.length >= 8);
});

test("insight loader requests each video once, bounded, and never exposes fabricated results", async () => {
  const calls = [];
  const changed = [];
  const loader = createInsightLoader({
    request: async id => { calls.push(id); return id === "a" ? { insight: { keyword: " night skate " } } : { insight: null }; },
    onChange: id => changed.push(id), maxConcurrent: 1,
  });
  assert.equal(loader.request("a"), true);
  assert.equal(loader.request("a"), false);
  loader.request("b");
  loader.request("c");
  await flush(); await flush(); await flush();
  assert.deepEqual(calls, ["a", "b", "c"]);
  assert.deepEqual(loader.get("a"), { keyword: "night skate" });
  assert.equal(loader.get("b"), null);
  assert.deepEqual(changed, ["a"]);
  loader.reset();
  assert.equal(loader.get("a"), null);
  assert.equal(loader.request("a"), true);
});

test("insight loader treats failures as no insight without retrying", async () => {
  let attempts = 0;
  const loader = createInsightLoader({ request: async () => { attempts++; throw new Error("404"); } });
  loader.request("x");
  await flush();
  loader.request("x");
  await flush();
  assert.equal(attempts, 1);
  assert.equal(loader.get("x"), null);
});

const post = (id, extra = {}) => ({ id, author: "u1", kind: "video", caption: `video ${id}`, media: ["/m.mp4"], mediaTypes: ["video/mp4"], mediaPosters: ["/p.png"], ...extra });
function ecosystem(posts, users = {}) {
  const calls = [];
  const eco = createExploreEcosystem({
    api: {
      cloudAccountId: () => "acct-1", me: () => ({ id: "me" }), cloudAuthorId: p => p.id,
      user: id => users[id] || { username: id },
      cacheCloudExplorePosts: list => list.map(item => post(item.id, item)),
    },
    requestCloudApi: async path => { calls.push(path); return { posts, people: [], places: [], hashtags: [], topics: [], topicOptions: [], emergingTopics: [], relatedSearches: [], postTopics: [], preferences: { hiddenTopics: [], personalize: true }, correctedQuery: null, hasMore: false, nextOffset: posts.length }; },
    esc: v => String(v ?? ""), ic: { search: "" }, renderMediaUrl: v => v, isLocalMedia: () => false, automaticAvatar: () => "a.svg",
    matchesHomeTopic: () => true, rerender() {}, openPostViewer() {}, navigateToProfile() {}, selectPlace() {}, toast() {}, isActive: () => true,
  });
  return { eco, calls };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("video cards carry a lazy, hidden insight slot only for public videos; no request on render", async () => {
  const f = ecosystem([post("pub"), post("friends", { visibility: "connections" }), post("priv", { author: "locked" }), post("photo", { kind: "photo", mediaTypes: [] })],
    { locked: { username: "locked", private: true } });
  f.eco.markup({ searching: true });
  await tick();
  f.eco.setQuery("skate", { immediate: true });
  await tick();
  const html = f.eco.markup({ searching: true }).body;
  assert.match(html, /data-xe-insight="pub"[^>]* hidden/);
  assert.doesNotMatch(html, /data-xe-insight="friends"/);
  assert.doesNotMatch(html, /data-xe-insight="priv"/);
  assert.doesNotMatch(html, /data-xe-insight="photo"/);
  assert.ok(!f.calls.some(path => path.includes("search-insight")), "rendering alone makes no insight requests");
});

test("app wires Search opens to the playback tracker and the search-click endpoint", async () => {
  const { readFileSync } = await import("node:fs");
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  assert.match(app, /\/api\/videos\/\$\{encodeURIComponent\(videoId\)\}\/search-click/);
  assert.match(app, /viewerSearchQuery = viewerSource === "search" \? String\(searchQuery/);
  assert.match(app, /viewerSource === "search" && viewerSearchQuery && api\.authMode\(\) === "cloud"/);
  const eco = readFileSync(new URL("./explore-ecosystem.js", import.meta.url), "utf8");
  assert.match(eco, /searchQuery: query/);
  assert.match(eco, /\/api\/videos\/\$\{encodeURIComponent\(id\)\}\/search-insight/);
});
