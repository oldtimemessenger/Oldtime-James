import test from "node:test";
import assert from "node:assert/strict";
import { publicFeedVideoLimitMessage, PUBLIC_FEED_VIDEO_MAX_BYTES } from "./public-feed-video-limits.js";

test("public main-feed videos have the 60-second and 16 MB limits", () => {
  assert.match(publicFeedVideoLimitMessage({
    visibility: "public", destination: "main", kind: "video", durationSeconds: 61, size: 1,
  }), /60 seconds/);
  assert.match(publicFeedVideoLimitMessage({
    visibility: "public", destination: "both", kind: "video", durationSeconds: 60, size: PUBLIC_FEED_VIDEO_MAX_BYTES + 1,
  }), /16 MB/);
  assert.equal(publicFeedVideoLimitMessage({
    visibility: "public", destination: "main", kind: "video", durationSeconds: 60, size: PUBLIC_FEED_VIDEO_MAX_BYTES,
  }), "");
});

test("those limits do not affect stories, private posts, photos, or Community-only posts", () => {
  for (const input of [
    { visibility: "public", destination: "story", kind: "video", durationSeconds: 200, size: 80 * 1024 * 1024 },
    { visibility: "connections", destination: "main", kind: "video", durationSeconds: 200, size: 80 * 1024 * 1024 },
    { visibility: "public", destination: "main", kind: "photo", durationSeconds: 200, size: 80 * 1024 * 1024 },
    { visibility: "public", destination: "community", kind: "video", durationSeconds: 200, size: 80 * 1024 * 1024 },
  ]) assert.equal(publicFeedVideoLimitMessage(input), "");
});
