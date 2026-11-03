import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./ui-foundations.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");

test("shared UI foundations are loaded by the main app entry", () => {
  assert.match(app, /import ["']\.\/ui-foundations\.css["']/);
});

test("shared semantic tokens alias the established Oldtime palette", () => {
  for (const token of [
    "--ot-color-brand", "--ot-color-text", "--ot-color-muted",
    "--ot-color-border", "--ot-color-page", "--ot-color-surface"
  ]) assert.match(css, new RegExp(token.replaceAll("-", "\\-") + "\\s*:"));
  assert.match(css, /--ot-color-brand:\s*var\(--color-primary/);
  assert.match(css, /--ot-color-text:\s*var\(--text/);
});

test("shared foundations define spacing, radius, typography, motion and layers", () => {
  for (const token of ["--ot-space-1", "--ot-space-4", "--ot-radius-md", "--ot-radius-xl",
    "--ot-control-height", "--ot-font-body", "--ot-motion-fast", "--ot-layer-dialog"])
    assert.ok(css.includes(token), token);
});

test("shared foundations respect reduced-motion preferences", () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
