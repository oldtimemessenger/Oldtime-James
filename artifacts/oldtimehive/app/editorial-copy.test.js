import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL(name, import.meta.url), "utf8");

test("public comment, like, and creator screens do not expose removed profile labels", () => {
  const comments = read("./cloud-comments.js");
  const likes = read("./post-likes-sheet.js");
  const creator = read("./creator-center.js");
  const app = read("./app.js");

  for (const source of [comments, likes, creator, app]) {
    assert.doesNotMatch(source, /editorial profiles|virtual profiles|social engine|engine operations/i);
  }
});
