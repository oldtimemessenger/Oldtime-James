import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const css = read("./unboxed-interface.css");

test("unboxed styling loads after every entry-point feature palette", () => {
  const imports = read("./app.js").match(/import "\.\/[^"]+\.css";/g);
  assert.equal(imports.at(-1), 'import "./unboxed-interface.css";');
});

test("icon and search backplate policy covers all ordinary feature families", () => {
  for (const selector of [
    ".community-story-find", ".icon", ".row-icon", ".settings-entry-icon",
    ".profile-action-close", ".profile-editor-emoji", ".discovery-back",
    ".comment-close", ".chat-head-icon", ".chat-action", ".drawer-close",
    ".ap-icon", ".ct-icon", ".ap-post-action", ".ap-close", ".ss-close",
    ".srp-close", ".srp-actic", ".pp-header [data-close]",
    ".blast-search-submit", ".bvn-feed-search button",
  ]) assert.ok(css.includes(selector), selector);
  assert.match(css, /background:transparent!important/);
  assert.match(css, /border-color:transparent!important/);
  assert.match(css, /box-shadow:none!important/);
  assert.ok(css.includes(".chat-search-trigger"));
  assert.ok(css.includes(".discovery-search-wrap"));
  assert.ok(css.includes(".chat-search-wrap"));
  assert.doesNotMatch(css, /(?:^|\n)\s*(?:img|video|\*|button)\s*[{,]/);
});

test("neutral and disabled palette fills retain readable text contrast", () => {
  const palette = read("./button-palette.css");
  for (const [token, value] of [["panel", "#f2f4f7"], ["card", "#ffffff"], ["bp-neutral", "#f2f4f7"], ["bp-disabled-bg", "#f2f4f7"]])
    assert.match(palette, new RegExp(`--${token}:${value};`));
  assert.ok(css.includes(".chat-option[aria-checked=true]"));
  assert.ok(css.includes("background:#e8f1ff!important"));
  assert.ok(css.includes("border-radius:999px!important"));
  assert.match(css, /#app :is\(\.chat-option\[aria-checked=true\],\.chat-folder-options button\.active\) \{[^}]*border-bottom:0!important/);
  assert.doesNotMatch(css, /(?:avatar|profile-cover|ce-canvas)[^{]*\{/);
});
