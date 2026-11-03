import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL(name, import.meta.url), "utf8");
const foundations = read("./ui-foundations.css");
const community = read("./community-feeds.css");
const app = read("./app.js");

test("shared UI foundations load before Community feed styles are used", () => {
  assert.match(app, /import "\.\/community-feeds\.css"/);
  assert.match(app, /import "\.\/ui-foundations\.css"/);
  assert.match(foundations, /--ot-color-brand:/);
  assert.match(foundations, /--ot-color-border:/);
});

test("Community feed uses shared semantic tokens for its main surfaces and controls", () => {
  assert.match(community, /\.cf-screen\s*\{[^}]*var\(--ot-color-page/);
  assert.match(community, /\.cf-feed-tabs button\[aria-current=page\]:after\s*\{[^}]*var\(--ot-color-brand/);
  assert.match(community, /\.cf-dialog\s*\{[^}]*var\(--ot-radius-xl/);
  assert.match(community, /\.cf-primary\s*\{[^}]*var\(--ot-color-brand/);
  assert.match(community, /\.cf-dialog :focus-visible\s*\{[^}]*var\(--ot-color-brand/);
});
