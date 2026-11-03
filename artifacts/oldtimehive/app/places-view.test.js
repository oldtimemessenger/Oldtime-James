import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const placesView = readFileSync(new URL("./places-view.js", import.meta.url), "utf8");

test("Places uses the requested nearby copy and restrained outline icons", () => {
  assert.match(placesView, /See places around you/);
  assert.doesNotMatch(placesView, /Your location is only used for this search/);
  assert.match(placesView, /stroke-width="1\.6"/);
});
