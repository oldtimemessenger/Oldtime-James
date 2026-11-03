import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createVideoStillQueue, stillPlaceholderMarkup, saveDataOn } from "./video-still.js";

const esc = s => String(s).replace(/"/g, "&quot;");
const tick = () => new Promise(r => setTimeout(r, 0));

test("queue decodes at most one video at a time", async () => {
  let running = 0, peak = 0; const release = [];
  const q = createVideoStillQueue({ resolveUrl: async r => r, extract: () => { running++; peak = Math.max(peak, running);
    return new Promise(res => release.push(() => { running--; res("data:image/jpeg;base64,x"); })); } });
  for (let i = 0; i < 12; i++) q.request(`p${i}`, `v${i}`);
  await tick();
  assert.equal(peak, 1); assert.equal(q.stats().waiting, 11);
  while (release.length) { release.shift()(); await tick(); await tick(); }
  assert.equal(peak, 1); assert.equal(q.stats().cached, 12);
});

test("cache is bounded, errors need explicit retry, clear resets per account", async () => {
  let fail = true;
  const q = createVideoStillQueue({ limit: 3, resolveUrl: async r => r, extract: async () => { if (fail) throw new Error("nope"); return "data:x"; } });
  q.request("a", "va"); await tick(); await tick();
  assert.equal(q.error("a"), "nope");
  assert.equal(q.request("a", "va"), false);
  fail = false;
  assert.equal(q.request("a", "va", { retry: true }), true); await tick(); await tick();
  assert.equal(q.get("a"), "data:x");
  for (const id of ["b", "c", "d"]) { q.request(id, id); await tick(); await tick(); }
  assert.equal(q.stats().cached, 3); assert.equal(q.get("a"), "");
  q.clear();
  assert.deepEqual(q.stats(), { cached: 0, waiting: 0, active: null });
});

test("placeholder markup: cached still renders img; Save-Data waits for a tap; errors offer retry", () => {
  assert.match(stillPlaceholderMarkup({ id: "p", ref: "r", still: "data:s", esc }), /^<img [^>]*src="data:s"/);
  const saver = stillPlaceholderMarkup({ id: "p", ref: "r", esc, saveData: true });
  assert.match(saver, /data-xe-still-manual="true"/); assert.match(saver, /Load preview/);
  assert.match(stillPlaceholderMarkup({ id: "p", ref: "r", esc, error: "x" }), /data-xe-still-retry="p">Retry preview/);
  assert.equal(saveDataOn({ connection: { saveData: true } }), true);
  assert.equal(saveDataOn({}), false);
});

test("real posters keep precedence; stills only for poster-less video; one shared queue", () => {
  const xe = readFileSync(new URL("./explore-ecosystem.js", import.meta.url), "utf8");
  const explore = readFileSync(new URL("./explore-ecosystem.js", import.meta.url), "utf8");
  const src = readFileSync(new URL("./video-still.js", import.meta.url), "utf8");
  assert.match(xe, /inner = poster\s*\?\s*`<img \$\{mediaAttributes\(poster, post\.author\)\}[\s\S]*?: videoStillMarkup\(post\)/);
  assert.match(xe, /owner = next;\s*stills\.clear\(\);/);
  assert.match(xe, /unbindStills\?\.\(\);/);
  assert.match(explore, /const rawMedia = post\.media\?\.\[0\];[\s\S]*?const media = isDefaultAvatarMediaReference\(rawMedia\) \? "" : rawMedia;/);
  assert.match(explore, /const rawPoster = post\.mediaPosters\?\.\[0\];[\s\S]*?const poster = isDefaultAvatarMediaReference\(rawPoster\) \? "" : rawPoster;/);
  assert.match(explore, /inner = poster\s*\?[\s\S]*?: videoStillMarkup\(post\)/);
  assert.match(explore, /stillPlaceholderMarkup\(\{ id, ref, owner: post\.author/);
  assert.match(src, /video\.muted = true;[\s\S]*playsInline = true;[\s\S]*preload = "metadata"/);
  assert.match(src, /removeAttribute\("src"\); video\.load\(\)/);
  assert.doesNotMatch(src, /\.play\(\)/);
});
