import test from "node:test";
import assert from "node:assert/strict";
import { loadToolsTheme, saveToolsTheme, normalizeToolsTheme, applyToolsTheme, TOOLS_THEME_KEY } from "./creative-controls-palette.js";

test("tools theme persists, defaults to black and survives denied storage", () => {
  const data = {}; const ok = { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  assert.equal(loadToolsTheme(ok), "dark");
  assert.equal(saveToolsTheme("light", ok), true); assert.equal(data[TOOLS_THEME_KEY], "light"); assert.equal(loadToolsTheme(ok), "light");
  const denied = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  assert.equal(loadToolsTheme(denied), "dark"); assert.equal(saveToolsTheme("light", denied), false);
  assert.equal(normalizeToolsTheme("neon"), "dark");
});

test("applyToolsTheme scopes the theme to the editor and marks the pressed button", () => {
  const buttons = ["light", "dark"].map(t => ({ dataset: { ceToolsTheme: t }, pressed: "", setAttribute(_, v) { this.pressed = v; } }));
  const editor = { dataset: {}, querySelectorAll: () => buttons };
  assert.equal(applyToolsTheme(editor, "light"), "light");
  assert.equal(editor.dataset.ceTools, "light"); assert.deepEqual(buttons.map(b => b.pressed), ["true", "false"]);
});
