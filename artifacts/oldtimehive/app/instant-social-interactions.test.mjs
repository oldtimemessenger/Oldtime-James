import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./app.js", import.meta.url), "utf8");

test("cloud likes update local state before waiting for the server", () => {
  const start = source.indexOf("async function like(id, forceLike = null, rerender = true)");
  const end = source.indexOf("const savingPostIds", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = source.slice(start, end);
  assert.match(handler, /pendingCloudLikeIds\.has\(id\)/);
  assert.ok(handler.indexOf("cloudPost.likes = shouldLike") < handler.indexOf("await api.setCloudLike(id, shouldLike)"));
  assert.match(handler, /syncCloudLikeButtons\(id, cloudPost, me, true\)/);
});

test("failed cloud likes restore prior likes, count, and liker list", () => {
  const start = source.indexOf("async function like(id, forceLike = null, rerender = true)");
  const end = source.indexOf("const savingPostIds", start);
  const handler = source.slice(start, end);
  assert.match(handler, /cloudPost\.likes = previous\.likes/);
  assert.match(handler, /cloudPost\.likeCount = previous\.likeCount/);
  assert.match(handler, /cloudPost\.likedBy = previous\.likedBy/);
  assert.match(handler, /pendingCloudLikeIds\.delete\(id\)/);
});

test("pending likes expose accessible state and preserve Community button styling", () => {
  assert.match(source, /button\.classList\.toggle\("like-pending", pending && liked\)/);
  assert.match(source, /button\.setAttribute\("aria-busy", "true"\)/);
  assert.match(source, /button\.setAttribute\("aria-pressed", String\(liked\)\)/);
  assert.match(source, /button\.classList\.toggle\(isCommunityPost \? "is-active" : "on", liked\)/);
});
