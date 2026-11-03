import test from "node:test";
import assert from "node:assert/strict";
import { downrankNotInterestedCreators } from "../src/cloudflare/feed-feedback-ranking.ts";

test("not-interested feedback keeps unrelated recommendations first and deprioritizes a creator", () => {
  const ranked = [
    { id: "p1", authorId: "a" },
    { id: "p2", authorId: "b" },
    { id: "p3", authorId: "a" },
    { id: "p4", authorId: "c" },
  ];
  const result = downrankNotInterestedCreators(ranked, [{ postId: "p1", authorId: "a" }]);
  assert.deepEqual(result.map(post => post.id), ["p2", "p4", "p3", "p1"]);
});

test("without account feedback, the existing personalized order is unchanged", () => {
  const ranked = [{ id: "p2", authorId: "a" }, { id: "p1", authorId: "b" }];
  assert.deepEqual(downrankNotInterestedCreators(ranked, []), ranked);
});
