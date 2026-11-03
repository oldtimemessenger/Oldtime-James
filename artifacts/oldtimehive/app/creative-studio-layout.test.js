import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./creative-studio-workspace.css", import.meta.url), "utf8");
const legacy = readFileSync(new URL("./creative-editor.css", import.meta.url), "utf8");
const rule = selector => {
  const out = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)) if (m[1].split(",").map(s => s.trim()).includes(selector)) out.push(m[2]);
  return out.join(";");
};
const z = body => Number(body.match(/z-index:\s*(\d+)/g)?.at(-1)?.match(/\d+/)[0]);

test("workspace hides every legacy footer chrome row while active", () => {
  for (const sel of [".cs-rail", ".cs-edit-foot", ".cs-video-tools", ".cs-transport"]) assert.match(css, new RegExp(`\\.cs-studio\\.has-workspace \\${sel}[\\s\\S]{0,200}display:none !important`), sel);
});

test("workspace chrome and tool sheets are opaque, and sheets never fade in", () => {
  assert.match(rule(".cs-studio.has-workspace .cs-ws"), /background:var\(--ws-bg\)/);
  assert.match(css, /--ws-bg:#[0-9a-f]{6};/i, "workspace background is a solid hex colour");
  assert.match(css, /--ws-card:#[0-9a-f]{6};/i);
  assert.match(rule(".cs-studio.has-workspace .cs-sheet"), /background:var\(--ws-card\)/);
  assert.match(rule(".cs-studio.has-workspace .cs-sheet"), /opacity:1/);
  const keyframes = css.match(/@keyframes cs-sheet-in \{[\s\S]*?\}\s*\}/)[0];
  assert.doesNotMatch(keyframes, /opacity/, "no translucent animation frames");
  assert.match(rule(".cs-studio.has-workspace .cs-sheet .cs-action:disabled"), /opacity:1/, "disabled actions stay legible, not see-through");
});

test("stacking: preview < workspace < tool sheet < explicit legacy inspector < text bar", () => {
  const ws = z(rule(".cs-studio.has-workspace .cs-ws")), sheet = z(rule(".cs-studio.has-workspace .cs-sheet"));
  const panel = z(rule(".cs-studio.has-workspace .ce-panel"));
  assert.ok(ws < sheet && sheet < panel && panel < 95, `${ws} < ${sheet} < ${panel} < 95`);
  assert.match(rule(".cs-studio.has-workspace .cs-sheet"), /bottom:calc\(var\(--ws-tools-h\) \+ var\(--cs-bottom\)\)/, "sheet docks above the tool bar");
  assert.match(rule(".cs-studio.has-workspace .ce-panel"), /background:#16171b/);
  assert.match(css, /\.cs-studio\.has-workspace\.has-ws-sheet \.cs-tl[^{]*\{[^}]*visibility:hidden/, "timeline does not show through or take focus under a sheet");
});

test("legacy inspector stays hidden until explicitly opened", () => {
  assert.match(legacy, /\.creative-editor \.ce-panel \{ display: none;/);
  assert.match(legacy, /\.creative-editor\.is-panel-open \.ce-panel/);
  assert.match(css, /\.cs-studio\.has-workspace \.cs-sheet\[hidden\] \{ display:none !important; \}/);
});
