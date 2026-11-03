import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../../api-server/src/routes/index.ts", import.meta.url), "utf8");

test("Live is an Oldtime drawer feature while direct calls remain mounted", () => {
  assert.match(appSource, /mountLiveView/);
  assert.match(appSource, /data-drawer-route=["']live/);
  assert.doesNotMatch(routeSource, /liveRouter|from ["']\.\/live["']/);
  assert.match(appSource, /mountComms/);
});
