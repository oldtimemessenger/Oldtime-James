import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = name => readFile(new URL(name, import.meta.url), "utf8");

test("cloud Story viewer renders before waiting for its signed media URL", async () => {
  const app = await read("./app.js");
  const start = app.indexOf("function openStory(authorId");
  const end = app.indexOf("\nfunction openProfilePostPlayback", start);
  assert.ok(start >= 0 && end > start, "openStory should remain a distinct viewer flow");
  const viewer = app.slice(start, end);
  assert.doesNotMatch(viewer, /Loading Story…/);
  assert.doesNotMatch(viewer, /await api\.loadCloudStoryMedia\(s\.id\)/);
  assert.match(viewer, /const cloudMediaRequest = needsCloudMedia \? api\.loadCloudStoryMedia\(s\.id\) : null/);
  assert.match(viewer, /story-stage-media-pending/);
  assert.match(viewer, /cloudMediaRequest\.then\(url =>/);
  assert.match(viewer, /mediaPending \|\| view\.dataset\.stickerOpen/);
});

test("the next Story media URL is prefetched without blocking the current Story", async () => {
  const app = await read("./app.js");
  const start = app.indexOf("function openStory(authorId");
  const end = app.indexOf("\nfunction openProfilePostPlayback", start);
  const viewer = app.slice(start, end);
  assert.match(viewer, /const nextStory = list\[i \+ 1\]/);
  assert.match(viewer, /void api\.loadCloudStoryMedia\(nextStory\.id\)\.catch\(\(\) => \{\}\)/);
});

test("concurrent requests for the same Story media URL share one request", async () => {
  const store = await read("./store.js");
  assert.match(store, /const cloudStoryMediaRequests = new Map\(\)/);
  assert.match(store, /const pending = cloudStoryMediaRequests\.get\(requestKey\)/);
  assert.match(store, /if \(pending\) return pending/);
  assert.match(store, /cloudStoryMediaRequests\.delete\(requestKey\)/);
});
