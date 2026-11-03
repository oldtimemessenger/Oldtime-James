import test from "node:test";
import assert from "node:assert/strict";
const { mergeLikes, canLoadMore, LIKES_MAX } = await import("./post-likes-sheet.js").catch(() => ({}));
test("likes pages dedupe and cap at 100", { skip: !mergeLikes }, () => {
  const a = mergeLikes([], [{ id: "1" }, { id: "2" }, { id: "1" }]);
  assert.deepEqual(a.map(p => p.id), ["1", "2"]);
  const big = mergeLikes(a, Array.from({ length: 150 }, (_, i) => ({ id: "x" + i })));
  assert.equal(big.length, LIKES_MAX);
  assert.equal(canLoadMore(big, true), false);
  assert.equal(canLoadMore(a, true), true);
  assert.equal(canLoadMore(a, false), false);
});
