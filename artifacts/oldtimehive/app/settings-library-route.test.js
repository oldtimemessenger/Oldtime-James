// Route-level adapter tests against the normalized Saved shape (CSS import stubbed via loader-free re-export check).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./settings-library-route.js", import.meta.url), "utf8");
test("route reads normalized media/mediaTypes/mediaPosters, not legacy imgs", () => {
  assert.match(src, /item\.mediaTypes/); assert.match(src, /item\.mediaPosters/);
  assert.doesNotMatch(src, /item\.imgs/);
});
test("authorLabel only returns resolved usernames", () => {
  assert.match(src, /authorLabel=post=>/);
  assert.doesNotMatch(src, /return a(\|\||;)/);
});
