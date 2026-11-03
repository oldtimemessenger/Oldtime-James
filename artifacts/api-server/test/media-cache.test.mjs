import test from "node:test";
import assert from "node:assert/strict";
import { isPublicFeedVideoCacheEligible, MAX_PUBLIC_FEED_VIDEO_BYTES } from "../src/cloudflare/media.ts";

const media = (overrides = {}) => ({
  storage_scope: "public",
  media_role: "media",
  content_type: "video/mp4",
  size: 5 * 1024 * 1024,
  ...overrides,
});

test("only full GETs for public feed videos up to 16 MB are edge-cache candidates", () => {
  assert.equal(isPublicFeedVideoCacheEligible(media(), "GET", false, true), true);
  assert.equal(isPublicFeedVideoCacheEligible(media({ size: MAX_PUBLIC_FEED_VIDEO_BYTES }), "GET", false, true), true);
  assert.equal(isPublicFeedVideoCacheEligible(media({ size: MAX_PUBLIC_FEED_VIDEO_BYTES + 1 }), "GET", false, true), false);
  assert.equal(isPublicFeedVideoCacheEligible(media(), "HEAD", false, true), false);
  assert.equal(isPublicFeedVideoCacheEligible(media(), "GET", true, true), false);
  assert.equal(isPublicFeedVideoCacheEligible(media({ storage_scope: "message" }), "GET", false, true), false);
  assert.equal(isPublicFeedVideoCacheEligible(media(), "GET", false, false), false);
  assert.equal(isPublicFeedVideoCacheEligible(media({ content_type: "image/jpeg" }), "GET", false, true), false);
});
