import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../../api-server/src/routes/index.ts", import.meta.url), "utf8");
const gatewaySource = readFileSync(new URL("../../api-server/src/lib/live-gateway.ts", import.meta.url), "utf8");
const signalingSource = readFileSync(new URL("./comms/signaling.js", import.meta.url), "utf8");

test("Live room broadcasting is removed from the app and API", () => {
  assert.doesNotMatch(appSource, /data-drawer-route=["']live/);
  assert.doesNotMatch(appSource, /data-open-live/);
  assert.doesNotMatch(appSource, /mountLiveView|createLiveClient|function renderLiveExperience/);
  assert.doesNotMatch(routeSource, /liveRouter|from ["']\.\/live["']/);
  assert.equal(existsSync(new URL("./live-view.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("./live-client.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("./live.css", import.meta.url)), false);
  assert.equal(existsSync(new URL("../../api-server/src/lib/live-rooms.ts", import.meta.url)), false);
  assert.doesNotMatch(gatewaySource, /socket\.on\(["']live:/);
  assert.doesNotMatch(gatewaySource, /\.emit\(["']live:/);
});

test("Chat and notification updates remain available over the shared account socket", () => {
  assert.match(gatewaySource, /export async function notifyChatChanged/);
  assert.match(gatewaySource, /export function notifyAccountActivity/);
  assert.match(gatewaySource, /"chat:changed"/);
  assert.match(gatewaySource, /"notifications:changed"/);
  assert.match(signalingSource, /current\.on\("chat:changed"/);
  assert.match(signalingSource, /\.on\("notifications:changed"/);
  assert.match(signalingSource, /createCloudflareTransport/);
  assert.match(gatewaySource, /Voice and video calls are disabled in Oldtime/);
});
