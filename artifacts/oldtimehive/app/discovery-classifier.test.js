import test from "node:test";
import assert from "node:assert/strict";
import {
  availableDiscoveryPostCategories,
  discoveryPostCategoryIds,
  matchesDiscoveryPost,
} from "./discovery-classifier.js";

test("classifies humor and relationship posts from ordinary words without hashtags", () => {
  assert.deepEqual(
    discoveryPostCategoryIds({ caption: "My boyfriend turned date night into a whole joke" }),
    ["dating-humor", "humor", "relationships", "dating"],
  );
});

test("classifies basketball and common discovery topics from post text", () => {
  assert.deepEqual(
    discoveryPostCategoryIds({ caption: "LeBron had the whole arena laughing" }),
    ["nba", "humor"],
  );
  assert.deepEqual(
    discoveryPostCategoryIds({ caption: "Dinner after a long road trip", place: { label: "Miami" } }),
    ["food", "travel"],
  );
});

test("filters by category and searches captions, location, and tags without requiring a hashtag", () => {
  const post = { caption: "A funny first date", location: "Miami Beach", tags: ["summer"] };
  assert.equal(matchesDiscoveryPost(post, { category: "dating-humor" }), true);
  assert.equal(matchesDiscoveryPost(post, { query: "miami beach" }), true);
  assert.equal(matchesDiscoveryPost(post, { query: "summer" }), true);
  assert.equal(matchesDiscoveryPost(post, { category: "food" }), false);
});

test("only surfaces category chips represented in available content", () => {
  const categories = availableDiscoveryPostCategories([
    { caption: "A good recipe for dinner" },
    { caption: "Basketball highlights" },
  ]);
  assert.deepEqual(categories.map(category => category.id), ["nba", "food"]);
});
