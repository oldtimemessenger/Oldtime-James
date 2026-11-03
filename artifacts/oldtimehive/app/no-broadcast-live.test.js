import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("../../api-server/src/cloudflare/worker.ts", import.meta.url), "utf8");
const chatSource = readFileSync(new URL("../../api-server/src/cloudflare/chats.ts", import.meta.url), "utf8");
const realtimeSource = readFileSync(new URL("../../api-server/src/cloudflare/realtime.ts", import.meta.url), "utf8");
const signalingSource = readFileSync(new URL("./comms/signaling.js", import.meta.url), "utf8");

test("Live room broadcasting is removed from the app and Cloudflare API", () => {
  assert.doesNotMatch(appSource, /data-drawer-route=["']live/);
  assert.doesNotMatch(appSource, /data-open-live/);
  assert.doesNotMatch(appSource, /mountLiveView|createLiveClient|function renderLiveExperience/);
  assert.doesNotMatch(workerSource, /liveRouter|from ["']\.\/live["']|path\s*===\s*["']\/live/);
  assert.doesNotMatch(realtimeSource, /event\s*:\s*["']live:/);
  assert.match(chatSource, /input\.kind==="call"\)throw new ApiError\(410,"Calling is disabled\."\)/);
  assert.equal(existsSync(new URL("./live-view.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("./live-client.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("./live.css", import.meta.url)), false);
  assert.equal(existsSync(new URL("../../api-server/src/cloudflare/live-rooms.ts", import.meta.url)), false);
});

test("Chat and notification updates remain available over the per-account Cloudflare socket", () => {
  assert.match(realtimeSource, /export async function notifyRealtime/);
  assert.match(realtimeSource, /event:"chat:changed"/);
  assert.match(realtimeSource, /event:"notifications:changed"/);
  assert.match(workerSource, /notifyRealtime\(request,response,env\)/);
  assert.match(signalingSource, /current\.on\("chat:changed"/);
  assert.match(signalingSource, /\.on\("notifications:changed"/);
  assert.match(signalingSource, /createCloudflareTransport/);
});
