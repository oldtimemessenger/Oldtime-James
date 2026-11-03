import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tipIllustration, tipIllustrationKey } from "./tip-illustrations.js";
import { normalizeInterestWord } from "./interest-entry.js";
const source = file => readFileSync(new URL(file, import.meta.url), "utf8");

test("privacy articles have one topic-specific image rather than duplicated heroes", () => {
  const js = source("./experiences.js");
  assert.match(js, /content = article\(item\.title, item\.text, actions, item\.id\)/);
  const keys = ["information", "messaging", "audience", "location", "membership", "analytics"];
  assert.deepEqual(keys.map(tipIllustrationKey), keys);
  assert.equal(new Set(keys.map(tipIllustration)).size, keys.length);
  for (const key of keys) assert.match(tipIllustration(key), /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
});
test("Campaign entries are removed and legacy screens cannot reopen them", () => {
  assert.doesNotMatch(source("./app.js"), /entry\("campaigns"/);
  assert.doesNotMatch(source("./tools-content.js"), /link: "campaigns"/);
  assert.match(source("./app.js"), /settingsView\.startsWith\("campaign"\)\) settingsView = "home"/);
  assert.match(source("./experiences.js"), /view\.startsWith\("campaign"\)\) return extraScreen\("help"/);
});
test("known interest ids stay canonical and custom words remain safe", () => {
  assert.equal(normalizeInterestWord(" MUSIC ", [{id:"music", label:"Music"}]), "music");
  assert.equal(normalizeInterestWord(" Bird   watching "), "Bird watching");
  assert.equal(normalizeInterestWord("<img>"), "");
  assert.equal(normalizeInterestWord("x".repeat(41)), "");
});
test("charts use their allocated card height and profile refinement stays scoped", () => {
  assert.match(source("./studio-charts.jsx"), /el\.getBoundingClientRect\(\)\.height/);
  assert.doesNotMatch(source("./studio-charts.jsx"), /height=\{220\}/);
  assert.match(source("./profile-editor-refinement.css"), /font-size:16px/);
  assert.doesNotMatch(source("./profile-editor-refinement.css"), /overflow-x:hidden/);
});
