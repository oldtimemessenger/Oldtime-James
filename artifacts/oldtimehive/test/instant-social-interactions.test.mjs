import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");

test("cloud likes update the local post before waiting for the server", () => {
  const start = src.indexOf("async function like(id, forceLike = null, rerender = true)");
  const end = src.indexOf("const savingPostIds", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = src.slice(start, end);
  assert.match(handler, /pendingCloudLikeIds\.has\(id\)/);
  assert.ok(handler.indexOf("cloudPost.likes = shouldLike") < handler.indexOf("await api.setCloudLike(id, shouldLike)"));
  assert.match(handler, /syncCloudLikeButtons\(id, cloudPost, me, true\)/);
});

test("failed cloud likes restore the prior likes, count, and liker list", () => {
  const start = src.indexOf("async function like(id, forceLike = null, rerender = true)");
  const end = src.indexOf("const savingPostIds", start);
  const handler = src.slice(start, end);
  assert.match(handler, /cloudPost\.likes = previous\.likes/);
  assert.match(handler, /cloudPost\.likeCount = previous\.likeCount/);
  assert.match(handler, /cloudPost\.likedBy = previous\.likedBy/);
  assert.match(handler, /pendingCloudLikeIds\.delete\(id\)/);
});

test("cloud like buttons expose pending state accessibly", () => {
  assert.match(src, /button\.classList\.toggle\("like-pending", pending\)/);
  assert.match(src, /button\.setAttribute\("aria-busy", "true"\)/);
  assert.match(src, /button\.setAttribute\("aria-pressed", String\(liked\)\)/);
});
