import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const app = read("./app.js");
const store = read("./store.js");
const social = read("../../api-server/src/cloudflare/social.ts");
const comments = read("../../api-server/src/cloudflare/comments.ts");
const repository = read("../../api-server/src/cloudflare/post-repository.ts");
const migration = read("../../api-server/migrations/0036_community_post_threads.sql");
const styles = read("./community-screen.css");

test("Community composer creates ordered parts and links them after confirmed publication", () => {
  const composer = app.slice(app.indexOf("function openCommunityNoteComposer()"), app.indexOf("// Community cards"));
  for (const marker of ["community-thread-add", "community-thread-parts", "partKeys[index] ||= crypto.randomUUID()",
    "publishedIds[index] = published.id", "api.linkCloudPostThread(publishedIds[0],publishedIds.slice(1))",
    "mediaIds:index===0?mediaIds:[]", "if (publishedIds[index]) continue"]) {
    assert.ok(composer.includes(marker), marker);
  }
  assert.match(composer, /partInputs\(\)\.forEach\(\(field,index\)=>\{if\(publishedIds\[index\] \|\| partKeys\[index\]\)field\.readOnly=true/);
  assert.match(composer, /partInputs\(\)\[index\]\.readOnly = true/);
});

test("Community cards expose a dedicated viewer for connected thread parts", () => {
  assert.match(app, /data-thread-open/);
  assert.match(app, /async function openCommunityThread/);
  assert.match(app, /api\.loadCloudPostThread\(postId\)/);
  assert.match(store, /async loadCloudPostThread\(postId\)/);
  assert.match(store, /async linkCloudPostThread\(rootId, postIds\)/);
  assert.match(repository, /threadId:p\.thread_id/);
  assert.match(social, /ORDER BY thread_position ASC,created_at ASC,id ASC/);
  assert.match(social, /loadCommunityThreadPosts\(db,userId,rootId\)/);
});

test("thread API restricts linking to the author and matching audience", () => {
  assert.match(social, /async function communityPostThread/);
  assert.match(social, /root\.author_id !== userId/);
  assert.match(social, /post\.author_id!==userId/);
  assert.match(social, /post\.visibility!==root\.visibility \|\| post\.destination!==root\.destination/);
  assert.match(social, /up to 10 posts/);
  assert.match(social, /threadMatch/);
});

test("thread schema preserves order and prevents duplicate positions", () => {
  assert.match(migration, /ALTER TABLE posts ADD COLUMN thread_id TEXT REFERENCES posts\(id\)/);
  assert.match(migration, /ALTER TABLE posts ADD COLUMN thread_position INTEGER/);
  assert.match(migration, /CREATE UNIQUE INDEX posts_thread_position_unique/);
});

test("comment replies preserve arbitrary depth in storage and rendering", () => {
  assert.match(store, /const flatten = nodes => nodes\.flatMap\(comment => \[comment, \.\.\.flatten\(comment\.replies \|\| \[\]\)\]\)/);
  assert.match(app, /const renderReply = reply =>/);
  assert.match(app, /nested\.map\(renderReply\)/);
  assert.match(app, /input\.dataset\.reply = comment\.id/);
  assert.match(comments, /parent_id/);
});

test("thread UI keeps the existing Oldtime blue palette", () => {
  assert.match(styles, /community-thread-affordance/);
  assert.match(styles, /#1555d8/);
  assert.doesNotMatch(styles, /community-thread-affordance[^}]*#0[0-9a-f]{5}/i);
});
