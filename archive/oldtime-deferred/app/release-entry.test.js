import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the Oldtime release entry loads the approved Oldtime Technologies app", async () => {
  const entry = await readFile(new URL("./release-entry.js", import.meta.url), "utf8");
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(entry, /oldtime-technologies\/app\/app\.js/);
  assert.match(index, /src="app\/release-entry\.js"/);
});
