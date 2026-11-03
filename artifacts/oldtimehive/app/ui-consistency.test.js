import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL(name, import.meta.url), "utf8");
const foundations = read("./ui-foundations.css");
const community = read("./community-feeds.css");
const app = read("./app.js");

test("shared UI foundations load alongside Community feed styles", () => {
  assert.match(app, /import "\.\/community-feeds\.css"/);
  assert.match(app, /import "\.\/ui-foundations\.css"/);
  assert.match(foundations, /--ot-color-brand:/);
  assert.match(foundations, /--ot-color-border:/);
});

test("Community keeps its established colors while sharing consistent control sizing", () => {
  assert.match(community, /\.cf-screen \{ background:#fff; color:#14171c; \}/);
  assert.match(community, /\.cf-primary[^}]*background:#1555d8/s);
  assert.match(community, /\.cf-dialog \{\s*border-radius: var\(--ot-radius-xl, 20px\);\s*\}/);
  assert.match(community, /\.cf-primary \{\s*border-radius: var\(--ot-radius-pill, 24px\);\s*\}/);
});
