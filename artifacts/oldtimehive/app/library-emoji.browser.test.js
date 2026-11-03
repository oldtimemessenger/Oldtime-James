// Isolated browser fixture: account-library + settings-library-route + emoji picker.
// All data is local; store.js is replaced by a stub and every /api request is aborted.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shots = resolve(packageRoot, "..", "..", "attached_assets", "verification");
const chromiumPath = ["/repl/tools/bin/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
const UUID = "5f0c1d2e-8a7b-4c3d-9e1f-a2b3c4d5e6f7";
const svg = (fill, label) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="${fill}"/><text x="20" y="60" font-size="40" fill="white">${label}</text></svg>`)}`;

const storeStub = `
window.__writes = [];
export const api = {
  cloudAccountState: () => ({ emojiPreferences: { recent: ["\u{1F602}"], favorites: [] } }),
  updateCloudAccountState: async patch => { window.__writes.push(patch); },
};`;

const fixtureHtml = (port) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/app/styles.css"><link rel="stylesheet" href="/app/compact-interface.css"></head>
<body><main class="page" style="height:100dvh;overflow:auto"><div id="host"></div></main>
<textarea id="other"></textarea><textarea id="target">hi </textarea>
<script type="module">
import { mountLibrary } from "/app/settings-library-route.js";
import { icons } from "/app/icons.js";
import { openEmojiPicker } from "/app/emoji.js";
const PHOTO=${JSON.stringify(svg("#2a6f97", "PHOTO"))}, POSTER=${JSON.stringify(svg("#9b2226", "POSTER"))}, STORY=${JSON.stringify(svg("#386641", "STORY"))};
const users={"u-known":{id:"u-known",username:"marta.kel"}};
const posts=[
  {id:"p1",author:"u-known",kind:"photo",caption:"Harbour",media:[PHOTO],mediaTypes:["image/jpeg"],mediaPosters:[null],destination:"main",visibility:"public"},
  {id:"p2",author:"${UUID}",kind:"video",caption:"Clip",media:["https://media.invalid/v.mp4"],mediaTypes:["video/mp4"],mediaPosters:[POSTER],destination:"main",visibility:"public"},
];
const api={cloudAccountId:()=>"me",user:id=>users[id]||null,cacheCloudExplorePosts:p=>p,
  loadCloudAccountState:async()=>({}),updateCloudAccountState:async()=>{throw new Error("no writes in fixture")},setOwnPostArchived:async()=>{}};
const requestCloudApi=async path=>{
  window.__requests=(window.__requests||[]).concat(path);
  if(path.startsWith("/api/account/library/saved"))return {posts,hasMore:false,nextOffset:2};
  if(path==="/api/sounds/library")return {sounds:[]};
  if(path.startsWith("/api/stories/archived"))return {stories:[{id:"s1",hasMedia:true,createdAt:1717000000000}],hasMore:false};
  if(path.startsWith("/api/stories/s1/media-url"))return {url:STORY};
  throw new Error("unexpected "+path);
};
window.mount=mode=>{window.ctl?.cleanup?.();const host=document.getElementById("host");host.replaceChildren();
  window.ctl=mountLibrary({host,mode,api,requestCloudApi,app:null,esc:null,icons,toast:()=>{},back:()=>{},openPost:()=>{},openAudio:()=>{},create:()=>{}});};
window.openEmoji=()=>{const t=document.getElementById("target");t.focus();t.setSelectionRange(3,3);openEmojiPicker(t);};
window.ready=true;
</script></body></html>`;

test("Saved/Archive thumbnails, author labels and emoji picker at 320/390", { skip: !chromiumPath }, async () => {
  process.env.PORT ||= "5173";
  const server = await createServer({ configFile: resolve(packageRoot, "vite.config.ts"), logLevel: "silent", server: { host: "127.0.0.1", port: 0 } });
  await server.listen();
  const port = server.httpServer.address().port;
  const browser = await chromium.launch({ executablePath: chromiumPath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  mkdirSync(shots, { recursive: true });
  try {
    for (const width of [320, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: 760 }, serviceWorkers: "block" });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(String(e)));
      await page.route("**/api/**", r => r.abort());
      await page.route("**/media.invalid/**", r => r.abort());
      await page.route(/\/app\/store\.js(\?.*)?$/, r => r.fulfill({ contentType: "text/javascript", body: storeStub }));
      await page.route(`http://127.0.0.1:${port}/__fixture`, r => r.fulfill({ contentType: "text/html", body: fixtureHtml(port) }));
      await page.goto(`http://127.0.0.1:${port}/__fixture`);
      await page.waitForFunction(() => window.ready);

      // Saved
      await page.evaluate(() => window.mount("saved"));
      await page.waitForFunction(() => document.querySelectorAll(".acl-tile img").length >= 2, null, { timeout: 15000 });
      await page.waitForFunction(() => [...document.querySelectorAll(".acl-tile img")].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 10000 });
      const saved = await page.evaluate(() => ({
        srcs: [...document.querySelectorAll(".acl-tile img")].map(i => decodeURIComponent(i.src)),
        loaded: [...document.querySelectorAll(".acl-tile img")].every(i => i.complete && i.naturalWidth > 0),
        meta: [...document.querySelectorAll(".acl-tile-meta")].map(n => n.textContent.trim()),
        text: document.body.innerText,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        reels: /\bReels?\b/.test(document.body.innerText),
      }));
      assert.ok(saved.srcs.some(s => s.includes("PHOTO")), "photo thumbnail");
      assert.ok(saved.srcs.some(s => s.includes("POSTER")), "video uses server poster");
      assert.ok(saved.loaded, "images decoded");
      assert.deepEqual(saved.meta, ["@marta.kel", ""]);
      assert.ok(!saved.text.includes(UUID), "UUID never shown");
      assert.equal(saved.reels, false);
      assert.ok(saved.overflow <= 0, `saved overflow ${saved.overflow}`);
      await page.screenshot({ path: `${shots}/saved-${width}.png` });

      // Archive stories (plain string story media)
      await page.evaluate(() => window.mount("archive"));
      await page.waitForFunction(() => document.querySelector(".acl-story img")?.complete, null, { timeout: 15000 });
      assert.ok(decodeURIComponent(await page.locator(".acl-story img").getAttribute("src")).includes("STORY"));
      await page.screenshot({ path: `${shots}/archive-${width}.png` });

      // Emoji: one Recent -> Smileys opens with full grid
      await page.evaluate(() => window.openEmoji());
      const emo = await page.evaluate(() => {
        const panel = document.querySelector(".emoji-panel"), grid = document.querySelector(".emoji-grid");
        return { selected: document.querySelector(".emoji-categories [aria-selected=true]")?.textContent,
          count: grid.querySelectorAll("button").length, panelW: panel.scrollWidth - panel.clientWidth,
          docW: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          recentTab: !!document.querySelector('.emoji-categories [aria-label="Recent"]') };
      });
      assert.equal(emo.selected, "Smileys");
      assert.ok(emo.count > 50, `smileys count ${emo.count}`);
      assert.ok(emo.recentTab);
      assert.ok(emo.panelW <= 0 && emo.docW <= 0, "no horizontal overflow");
      await page.screenshot({ path: `${shots}/emoji-${width}.png` });
      // Recent still has the one entry
      await page.click('.emoji-categories [aria-label="Recent"]');
      assert.equal(await page.locator(".emoji-grid button").count(), 1);
      // Search full data, then insert
      await page.fill(".emoji-search", "flag");
      assert.ok(await page.locator(".emoji-grid button").count() > 200);
      await page.fill(".emoji-search", "");
      await page.click('.emoji-categories [aria-label="Smileys"]');
      await page.locator(".emoji-grid button").first().click();
      const vals = await page.evaluate(() => ({ t: document.getElementById("target").value, o: document.getElementById("other").value, w: window.__writes.length }));
      assert.equal(vals.t, "hi \u{1F600}");
      assert.equal(vals.o, "");
      assert.ok(vals.w >= 1, "preference write went to stub only");
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); await server.close(); }
});
