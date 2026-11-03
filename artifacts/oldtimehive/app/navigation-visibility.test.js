import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("bottom navigation stays opaque with no fade, gradient or dimming across tabs", () => {
  const css = readFileSync(new URL("./quiet-interface.css", import.meta.url), "utf8");
  assert.match(css, /#app \.phone>nav\.nav\{[^}]*background-image:none!important/);
  assert.match(css, /#app \.media-feed-phone>nav\.nav\{background:#090a0c!important/);
  assert.match(css, /#app \.phone>nav\.nav,#app \.phone>nav\.nav \*\{opacity:1!important;transition:none!important;animation:none!important;filter:none!important/);
});
