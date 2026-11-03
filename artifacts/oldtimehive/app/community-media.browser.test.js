// Isolated fixture: real community-post-media.js + community-screen.css on a fake origin.
// Every non-fixture request is aborted and any mutation (non-GET) is recorded and must stay zero.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/repl/tools/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome"
  ].filter(Boolean);
  const installed = candidates.find(path => existsSync(path));
  if (installed) return installed;

  for (const command of ["chromium", "chromium-browser", "google-chrome"]) {
    try {
      return execFileSync("which", [command], { encoding: "utf8" }).trim();
    } catch {}
  }
  throw new Error("Chromium is required for the Oldtime browser regression test.");
}


const chromiumPath = (() => { try { return findChromium(); } catch { return ""; } })();
const ORIGIN = "https://fixture.oldtime.test";
const mod = readFileSync(new URL("./community-post-media.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./community-screen.css", import.meta.url), "utf8");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
const html = `<!doctype html><html><head><style>${css}</style><style>body{margin:0;--font:system-ui}</style></head>
<body><div id="app" class="stories-phone"><main id="feed"></main><input id="picker" type="file" multiple accept="image/*,video/*"><p id="msg"></p><p id="count"></p></div>
<script type="module">
import * as m from "/community-post-media.js";
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const deps = n => ({ esc, sourceAttr: s => 'src="'+esc(s)+'"', playIcon: "<svg viewBox='0 0 24 24'><path d='m8 4 12 8-12 8z'/></svg>", handle: "fixture" });
const feed = document.getElementById("feed");
for (const n of [1,2,3,4,5,6]) {
  const refs = Array.from({length:n}, (_, i) => "/px.png");
  const types = refs.map((_, i) => i === 1 ? "video/mp4" : "image/png");
  const items = m.communityMediaItems({ mediaTypes: types }, refs);
  feed.insertAdjacentHTML("beforeend", '<article class="community-post-card" data-n="'+n+'">'+m.communityGridMarkup("p"+n, items, deps(n))+'</article>');
}
// Video card skeleton mirrors app.js communityPostCard video-card structure (CSS proof only).
feed.insertAdjacentHTML("beforeend", '<article class="community-post-card community-video-card" id="vc"><div class="cvc-stage"><button class="cvc-media"><video muted></video></button><button class="cvc-sound">s</button><div class="cvc-panel"><header class="cvc-author"><button class="community-post-avatar"></button><button class="cvc-identity"><b>Travel E</b><small>2d</small></button></header><div class="cvc-actions"><button>1</button><button>0</button><span class="cvc-spacer"></span><button>share</button></div><button class="cvc-comment-prompt">'+m.commentPromptLabel(0)+'</button></div></div></article>');
let list = [];
document.getElementById("picker").onchange = e => {
  const r = m.addComposerFiles(list, e.target.files); list = r.next;
  document.getElementById("msg").textContent = m.rejectionMessage(r.rejected);
  document.getElementById("count").textContent = String(list.length);
};
window.__ready = true;
</script></body></html>`;

for (const width of [320, 390]) {
  test(`Community grid, video card and 6-file limit at ${width}px`, { skip: !chromiumPath && "Chromium not available" }, async () => {
    const browser = await chromium.launch({ executablePath: chromiumPath });
    const mutations = [];
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", route => {
        const req = route.request();
        if (req.method() !== "GET") { mutations.push(`${req.method()} ${req.url()}`); return route.abort(); }
        const url = new URL(req.url());
        if (url.origin !== ORIGIN) return route.abort();
        if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
        if (url.pathname === "/community-post-media.js") return route.fulfill({ contentType: "text/javascript", body: mod });
        if (url.pathname === "/px.png") return route.fulfill({ contentType: "image/png", body: png });
        return route.abort();
      });
      await page.goto(ORIGIN + "/");
      await page.waitForFunction(() => window.__ready);
      const grids = await page.$$eval(".community-attachment-grid", gs => gs.map(g => {
        const r = g.getBoundingClientRect();
        const tiles = [...g.children].map(t => t.getBoundingClientRect());
        return { count: tiles.length, width: r.width, height: r.height, right: r.right, tiles: tiles.map(t => ({ w: Math.round(t.width), h: Math.round(t.height) })) };
      }));
      assert.deepEqual(grids.map(g => g.count), [1, 2, 3, 4, 5, 6]);
      for (const g of grids) {
        assert.ok(g.right <= width + 0.5, `grid fits ${width}px`);
        assert.ok(g.height > 60 && g.height < g.width * 1.01, "grid is landscape/compact, not a tall full-bleed card");
        for (const t of g.tiles) assert.ok(t.w > 20 && t.h > 20, "every tile visible");
      }
      assert.ok(grids[2].tiles[0].h > grids[2].tiles[1].h * 1.8, "3-up: first tile spans both rows");
      assert.equal(new Set(grids[5].tiles.map(t => t.w)).size <= 2, true, "6-up: uniform 3x2");
      assert.equal(await page.locator(".community-grid-play").count(), 5, "play badge on each video tile only");
      const card = await page.$eval("#vc", el => {
        const s = el.querySelector(".cvc-stage").getBoundingClientRect();
        const p = el.querySelector(".cvc-panel").getBoundingClientRect();
        const prompt = el.querySelector(".cvc-comment-prompt");
        return { s, p, radius: getComputedStyle(el.querySelector(".cvc-stage")).borderTopLeftRadius, prompt: prompt.textContent, promptW: prompt.getBoundingClientRect().width };
      });
      assert.ok(card.s.width >= width - 24 && card.s.right <= width, "card is near full-bleed and fits");
      assert.ok(card.p.bottom <= card.s.bottom && card.p.top > card.s.top + card.s.height * 0.4, "frosted panel overlays lower media");
      assert.notEqual(card.radius, "0px");
      assert.equal(card.prompt, "Be the first to comment");
      const files = Array.from({ length: 7 }, (_, i) => ({ name: `f${i}.${i % 2 ? "mp4" : "png"}`, mimeType: i % 2 ? "video/mp4" : "image/png", buffer: png }));
      files.push({ name: "doc.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
      await page.setInputFiles("#picker", files);
      assert.equal(await page.textContent("#count"), "6");
      const msg = await page.textContent("#msg");
      assert.match(msg, /up to 6/); assert.match(msg, /f6\.png/); assert.match(msg, /doc\.txt/);
      if (process.env.OLDTIME_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.OLDTIME_SCREENSHOT_DIR}/community-media-${width}.png`, fullPage: true });
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      assert.deepEqual(mutations, [], "no network mutations");
    }
  });
}
