import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async path => readFile(new URL(path, import.meta.url), "utf8");
const [store, signaling, saved, creator, surfaces] = await Promise.all([
  read("./store.js"),
  read("./comms/signaling.js"),
  read("./saved-collections.js"),
  read("./creator-center.js"),
  read("./flat-surfaces.css"),
]);

test("chat and notification connections follow sign-in and refresh after the app resumes", () => {
  assert.match(store, /oldtime-cloud-session-changed/);
  assert.match(signaling, /addEventListener\("oldtime-cloud-session-changed"/);
  assert.match(signaling, /addEventListener\("online"/);
  assert.match(signaling, /addEventListener\("visibilitychange"/);
  assert.match(signaling, /createCloudflareTransport/);
  assert.match(signaling, /\.on\("connect", refreshLiveViews\)/);
  assert.match(signaling, /requestCloudApi\("\/api\/realtime\/ticket"/);
});

test("cloud bookmarks confirm with the server before the UI reports success", () => {
  const start = saved.indexOf("export async function setPostSaved");
  const end = saved.indexOf("\nexport ", start + 1);
  const handler = saved.slice(start, end < 0 ? undefined : end);
  assert.match(handler, /await api\.loadCloudAccountState\(\)/);
  assert.match(handler, /await api\.updateCloudAccountState\(/);
  assert.match(handler, /patchOnly:\s*true/);
  assert.match(handler, /projectCloudSavedState\(\)/);
  assert.match(handler, /syncCloudState:\s*false/);
  assert.match(handler, /catch \(error\)[\s\S]*?throw error/);
  assert.match(store, /setCloudPostSavedState\(id, saved\)/);
});

test("the permanent badge summary uses the full mobile content width", () => {
  assert.match(creator, /ct-card ct-badge-summary/);
  assert.match(surfaces, /\.ct-wrap \.ct-badge-summary\{display:block;width:100%;min-width:0\}/);
  assert.match(surfaces, /\.ct-wrap \.ct-badge-summary h2,\.ct-wrap \.ct-badge-summary p\{overflow-wrap:normal;word-break:normal;white-space:normal\}/);
});
