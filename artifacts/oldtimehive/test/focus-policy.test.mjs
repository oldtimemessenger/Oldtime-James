import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("editable focus policy includes body-mounted emoji sheets without disabling selection", () => {
  const css = readFileSync(new URL("../app/focus-policy.css", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");
  assert.match(app, /import "\.\/focus-policy\.css"/);
  assert.match(css, /:root body :is\(input, textarea, select,/);
  assert.match(css, /:is\(:focus, :focus-visible\)/);
  assert.match(css, /outline: none !important/);
  assert.match(css, /box-shadow: none !important/);
  assert.doesNotMatch(css, /user-select\s*:\s*none|::selection|pointer-events\s*:\s*none/);
});
