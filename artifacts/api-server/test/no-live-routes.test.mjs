import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const sourceDirectory = new URL("../src/cloudflare/", import.meta.url);
const routeIndex = readFileSync(new URL("worker.ts", sourceDirectory), "utf8");
const liveRoute = new URL("../src/routes/live.ts", import.meta.url);
const gateway = readdirSync(sourceDirectory).filter(name=>name.endsWith(".ts")).map(name=>readFileSync(new URL(name,sourceDirectory),"utf8")).join("\n");

test("public Live broadcast routes and room socket handlers are not part of the API", () => {
  assert.equal(existsSync(liveRoute), false);
  assert.doesNotMatch(routeIndex, /liveRouter|from ["']\.\/live["']/);
  assert.equal(existsSync(new URL("../src/lib/live-rooms.ts", import.meta.url)), false);
  assert.doesNotMatch(gateway, /socket\.on\(["']live:/);
  assert.doesNotMatch(gateway, /\.emit\(["']live:/);
  assert.match(gateway, /"chat:changed"/);
  assert.match(gateway, /"notifications:changed"/);
});
