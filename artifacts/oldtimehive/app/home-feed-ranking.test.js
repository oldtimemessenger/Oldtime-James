import test from "node:test";
import assert from "node:assert/strict";
import { rankHomeRecommendations } from "./home-feed-ranking.js";

test("For You gives signup interests priority while retaining a varied feed", () => {
  const posts = [
    { id: "offtopic", author: "a", caption: "a quiet day" },
    { id: "fashion-a", author: "a", caption: "new fashion finds" },
    { id: "fashion-b", author: "a", caption: "fashion outfit ideas" },
    { id: "food", author: "b", caption: "easy weeknight dinner recipes" },
  ];
  const ranked = rankHomeRecommendations(posts, ["fashion", "food"], {
    fashion: ["fashion", "outfit"],
    food: ["recipe", "dinner"],
  });
  assert.equal(ranked[0].id, "fashion-a");
  assert.equal(ranked[1].id, "food");
  assert.equal(ranked.length, posts.length);
  assert.equal(ranked.some(post => post.id === "offtopic"), true);
});

test("For You preserves its existing order when no interests are selected", () => {
  const posts = [{ id: "first" }, { id: "second" }];
  assert.deepEqual(rankHomeRecommendations(posts), posts);
});
