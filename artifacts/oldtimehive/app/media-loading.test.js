import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("feed, profile, and chat media are lazy rather than eagerly fetched", async () => {
  const [app, chat, loader, styles] = await Promise.all([
    readFile(new URL("./app.js", import.meta.url), "utf8"),
    readFile(new URL("./chat.js", import.meta.url), "utf8"),
    readFile(new URL("./local-media.js", import.meta.url), "utf8"),
    readFile(new URL("./styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /loop playsinline preload="none"/);
  assert.match(app, /loading="lazy" decoding="async"/);
  assert.match(app, /playsinline preload="none"/);
  assert.match(app, /preload="none" \$\{muted \? "muted" : ""\}/);
  assert.match(chat, /controls playsinline preload="none"/);
  assert.match(loader, /rootMargin: "80px 0px"/);
  assert.match(loader, /isFeedVideo\(element\) \? loadFeedVideoPoster\(element\) : loadElement\(element\)/);
  assert.match(loader, /export async function loadFeedVideo\(element,/);
  assert.match(loader, /element\.preload = "none"/);
  assert.doesNotMatch(loader, /element\.preload = .*"metadata"/);
  assert.match(loader, /element\.fetchPriority = rect\.bottom > 0 && rect\.top < window\.innerHeight \? "high" : "low"/);
  assert.match(loader, /const profileAvatar = element\.matches\("\.profile-avatar, \.story-avatar-action img, \.ring img, \.cic-photo, \.csc-media, \.chat-avatar, \.details-avatar, \.chat-inbox-avatar img, \.discovery-person-profile img, \.cf-person-avatar img"\)/);
  assert.match(loader, /if \(element\.tagName === "IMG" \|\| element\.tagName === "VIDEO"\) element\.hidden = true/);
  assert.match(loader, /element\.hidden = false;\s*element\.classList\.remove\("media-load-failed"\)/);
  assert.match(app, /if \(isLocalMedia\(v\.dataset\.localMedia\) && !v\.src\)[\s\S]*?await loadFeedVideo\(v\)/);
  assert.match(loader, /local-media-unavailable--cover/);
  assert.match(styles, /\.profile-cover > \.local-media-unavailable--cover\s*\{[^}]*position:absolute/);
  assert.match(styles, /\.profile-cover > img\.media-load-failed\s*\{\s*visibility:hidden/);
});

test("the feed preloads the next video's opening for at most two nearby videos", async () => {
  const [app, loader, prefetch] = await Promise.all([
    readFile(new URL("./app.js", import.meta.url), "utf8"),
    readFile(new URL("./local-media.js", import.meta.url), "utf8"),
    readFile(new URL("./feed-video-prefetch.js", import.meta.url), "utf8"),
  ]);
  assert.match(app, /rootMargin: FEED_VIDEO_PREFETCH_ROOT_MARGIN/);
  assert.match(app, /pending < 2/);
  assert.match(app, /prefetchFeedVideoMetadata\(video, loadFeedVideo\)/);
  assert.match(prefetch, /video\.preload = "auto"/);
  assert.match(loader, /pendingFeedVideoLoads = new WeakMap\(\)/);
});

test("profile video tiles without a saved poster never render as black unloaded video elements", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("./app.js", import.meta.url), "utf8"),
    readFile(new URL("./styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /p\.kind === "video" && !poster\s*\?\s*`<span class="profile-video-preview-fallback"/);
  assert.match(app, /profile-video-preview-fallback[\s\S]*?Tap to play/);
  assert.match(styles, /\.profile-video-preview-fallback\s*\{[^}]*background:linear-gradient/);
});

test("story rings and failed album media stay within their compact boxes", async () => {
  const [styles, collections, loader] = await Promise.all([
    readFile(new URL("./styles.css", import.meta.url), "utf8"),
    readFile(new URL("./profile-presentations.css", import.meta.url), "utf8"),
    readFile(new URL("./local-media.js", import.meta.url), "utf8"),
  ]);
  assert.match(styles, /\.story-avatar-action \.ring\s*\{[^}]*display:block;[^}]*box-sizing:border-box;[^}]*overflow:hidden/);
  assert.match(styles, /\.story-avatar-action \.ring img\s*\{[^}]*display:block;[^}]*box-sizing:border-box/);
  assert.match(collections, /\.ot-collection-tile \.media-load-failed\s*\{\s*display:none/);
  assert.match(collections, /\.ot-collection-tile \.local-media-unavailable > span\s*\{[^}]*position:static;[^}]*max-width:100%;[^}]*overflow:hidden/);
  assert.match(loader, /if \(cardThumb\) \{\s*notice\.append\(text\);/);
  assert.match(styles, /\.profile-cover > \.local-media-unavailable--cover\s*\{[^}]*top:calc\(max\(12px, env\(safe-area-inset-top, 0px\)\) \+ 50px\);[^}]*bottom:auto/);
});

test("failed feed videos show a centered, readable retry instead of inline overflow", async () => {
  const [loader, styles] = await Promise.all([
    readFile(new URL("./local-media.js", import.meta.url), "utf8"),
    readFile(new URL("./styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(loader, /const video = element\.tagName === "VIDEO"/);
  assert.match(loader, /retry\.textContent = "Try again"/);
  assert.match(styles, /\.clip > \.local-media-unavailable:not\(\.local-media-unavailable--compact\):not\(\.local-media-unavailable--cover\)\s*\{[^}]*position:absolute;[^}]*gap:10px/);
  assert.match(styles, /\.clip > \.local-media-unavailable:not\(\.local-media-unavailable--compact\):not\(\.local-media-unavailable--cover\) > button\s*\{[^}]*min-height:38px/);
});

test("legacy Search results defer offscreen thumbnail work", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const start = app.indexOf("function search()");
  const search = app.slice(start, app.indexOf("function notes()", start));
  assert.ok(search.includes('<img data-avatar-hit ${profileMediaSource(user.avatar)} alt="" loading="lazy" decoding="async" fetchpriority="low" />'));
  assert.ok(search.includes('<img ${attrs} alt="" loading="lazy" decoding="async" fetchpriority="low" />'));
  assert.ok(search.includes('<video ${attrs} muted playsinline preload="none"></video>'));
});
