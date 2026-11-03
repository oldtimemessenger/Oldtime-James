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

test("Community feed maps its key surfaces and controls to shared semantic tokens", () => {
  assert.ok(community.includes(".cf-screen {\n  background: var(--ot-color-page"));
  assert.ok(community.includes(".cf-feed-tabs button[aria-current=page]:after {\n  background: var(--ot-color-brand"));
  assert.ok(community.includes(".cf-dialog {\n  border-color: var(--ot-color-border"));
  assert.ok(community.includes("border-radius: var(--ot-radius-xl"));
  assert.ok(community.includes(".cf-primary {\n  border-radius: var(--ot-radius-pill"));
  assert.ok(community.includes(".cf-dialog :focus-visible {\n  outline-color: var(--ot-color-brand"));
});
