import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVideoSearchText, videoSearchTerms } from "./video-search-insights";

test("normalizes query punctuation, case, links, and whitespace", () => {
  assert.equal(normalizeVideoSearchText("  🔍 FT Call, MISSED meme!! https://example.com/x "), "ft call missed meme");
});

test("removes stop words and duplicate terms", () => {
  assert.deepEqual(videoSearchTerms("The FT call is a missed meme, meme!"), ["ft","call","missed","meme"]);
});

test("keeps Unicode search terms", () => {
  assert.deepEqual(videoSearchTerms("café 東京"), ["café","東京"]);
});
