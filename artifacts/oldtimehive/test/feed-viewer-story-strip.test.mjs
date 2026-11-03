import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/post-detail.css", import.meta.url), "utf8");
test("sound toggle renders in rail before actions", () => {
  assert.match(src, /<div class="rail">\s*\$\{p\.kind === "video" \? `<button type="button" class="soundbar-toggle rail-sound-toggle"[\s\S]*?\$\{actions\}/);
});
test("story strip collapses on downward scroll / first-post interaction", () => {
  assert.match(src, /delta > 4\) setStoriesCollapsed\(true\)/);
  assert.match(src, /clip === feedScroller\.querySelector\("\.clip"\)/);
});
test("viewer footer is not an opaque band and media stays contained", () => {
  assert.match(css, /post-viewer-explore \.post-viewer-footer \{ background:linear-gradient\(transparent/);
  assert.doesNotMatch(css, /object-fit:\s*cover[^}]*post-viewer/);
});
test("avatar opens story, name opens profile", () => {
  assert.match(src, /if \(story\) return openStory\(id, story\.id\);/);
  assert.match(src, /data-profile="\$\{esc\(u\.id\)\}"/);
});

import { followedAuthorPosts } from "../app/feed-posts.js";
import { feedFollowButton } from "../app/feed-follow.js";
test("Following feed keeps only confirmed followed authors", () => {
  const me = { id: "me", following: ["a"], friends: ["f"] };
  const posts = [{ id: 1, author: "a" }, { id: 2, author: "x", repostedByFollowing: true }, { id: 3, author: "f" }, { id: 4, author: "me" }, { id: 5, author: { id: "a" } }];
  assert.deepEqual(followedAuthorPosts(posts, me).map(p => p.id), [1, 5]);
  assert.deepEqual(followedAuthorPosts(posts, { id: "me" }), []);
  assert.match(src, /homeView === "following"\) posts = followedAuthorPosts\(posts, me\)/);
});
test("follow control reflects confirmed relationship state", () => {
  const esc = s => String(s);
  const me = { id: "me", following: ["a"] };
  assert.match(feedFollowButton({ author: { id: "a" }, me, following: false, className: "c", esc }), />Following</);
  assert.match(feedFollowButton({ author: { id: "b" }, me, following: true, className: "c", esc }), />Follow</);
  assert.match(feedFollowButton({ author: { id: "b" }, me, requests: [{ from: "me", to: "b" }], className: "c", esc }), />Requested</);
});
