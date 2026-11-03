import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright-core";
import { createServer } from "vite";

// Isolated owner/visitor profile header layout fixture. Fake local data only; every /api request is blocked.
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shotDir = resolve(packageRoot, "../../screenshots/profile-header");
const chromiumPath = [process.env.CHROMIUM_PATH, "/repl/tools/bin/chromium", "/usr/bin/chromium"].filter(Boolean).find(existsSync);

const person = (id, extra = {}) => ({
  id, username: id.replace(/-/g, ""), name: id.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" "),
  avatar: "/app/avatar.svg", private: false, followers: [], following: [], friends: [], closeFriends: [],
  interests: [], profileVisibility: { city: true, interests: true }, ...extra,
});
const fixture = {
  session: "fixture-owner",
  settings: { readReceipts: true, lastSeen: "everyone" },
  users: [
    person("fixture-owner", { name: "Fixture Owner With A Longer Display Name", city: "Philadelphia, US",
      interests: ["basketball", "music", "photography"], followers: ["fan-one", "fan-two", "fan-three", "fan-four"],
      following: ["fan-one", "fan-two"], bio: "Fixture bio for layout checks." }),
    person("visitor-target", { city: "Lisbon", interests: ["travel"], followers: [], following: ["fixture-owner"] }),
    person("fan-one"), person("fan-two"), person("fan-three"), person("fan-four"),
  ],
  posts: [], stories: [], chats: [], requests: [], friendRequests: [], notifications: [],
};

test("profile header owner and visitor layouts at 320px and 390px", { skip: !chromiumPath && "Chromium unavailable", timeout: 180_000 }, async () => {
  process.env.PORT ||= "5173"; process.env.BASE_PATH ||= "/";
  const server = await createServer({ configFile: resolve(packageRoot, "vite.config.ts"), logLevel: "silent", server: { host: "127.0.0.1", port: 0, strictPort: false } });
  let browser;
  try {
    await server.listen();
    const { port } = server.httpServer.address();
    browser = await chromium.launch({ executablePath: chromiumPath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    mkdirSync(shotDir, { recursive: true });
    const writes = [];
    for (const width of [320, 390]) {
      const context = await browser.newContext({ serviceWorkers: "block", viewport: { width, height: 844 } });
      await context.route("**/api/**", route => {
        if (route.request().method() !== "GET") writes.push(route.request().url());
        const stats = { fixtureowner: ["fixture-owner", 1284, 317], visitortarget: ["visitor-target", 0, 1] };
        const hit = Object.entries(stats).find(([name]) => route.request().url().endsWith(`/api/profiles/${name}`));
        if (hit && route.request().method() === "GET") {
          const [, [id, followerCount, followingCount]] = hit;
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profile: { id, username: hit[0] }, stats: { followerCount, followingCount, viewCount: 9 } }) });
        }
        return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"blocked in fixture"}' });
      });
      await context.addInitScript(state => {
        if (!localStorage.getItem("oldtime-v1")) localStorage.setItem("oldtime-v1", JSON.stringify(state));
        sessionStorage.clear();
        sessionStorage.setItem("oldtime-cloud-session-v1", JSON.stringify({ account: { id: state.session }, accessToken: "a".repeat(43), expiresAt: Date.now() + 600_000 }));
      }, fixture);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/`);
      await page.waitForFunction(() => typeof window.__oldtimeOpenProfilePreview === "function", null, { timeout: 60_000 });
      for (const [label, id] of [["owner", "fixture-owner"], ["visitor", "visitor-target"]]) {
        await page.evaluate(target => window.__oldtimeOpenProfilePreview(target), id);
        await page.locator(".profile-screen .profile-stats").waitFor({ state: "visible" });
        await page.waitForTimeout(1200); // let entrance motion and stats refresh settle
        const m = await page.evaluate(() => {
          const r = s => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
          return {
            vw: document.documentElement.clientWidth, docW: document.documentElement.scrollWidth,
            cards: [...document.querySelectorAll(".profile-count-card")].map(c => { const b = c.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, w: b.width, h: b.height, faces: c.querySelectorAll(".profile-count-faces img").length, text: c.innerText }; }),
            stats: document.querySelector(".profile-stats").innerText,
            meta: r(".profile-meta-row"), actions: r(".profile-primary-actions"), name: r(".profile-name"), avatar: r(".profile-avatar"),
            edit: r("#edit"), follow: r("#pfollow"), msg: r("#pmsg"), cover: r(".profile-cover"),
            overflow: [...document.querySelectorAll(".profile-intro *")].filter(el => { const b = el.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1); }).map(el => el.className || el.tagName).slice(0, 5),
          };
        });
        console.log(width, label, JSON.stringify(m));
        await page.screenshot({ path: resolve(shotDir, `${label}-${width}.png`) });
        assert.equal(m.cards.length, 2, `${label}@${width}: two count cards`);
        assert.match(m.stats, /followers[\s\S]*following/i);
        assert.ok(Math.abs(m.cards[0].w - m.cards[1].w) < 1.5 && Math.abs(m.cards[0].t - m.cards[1].t) < 1, `${label}@${width}: equal cards side by side`);
        assert.ok(m.cards[1].r <= m.vw + 0.5 && m.docW <= m.vw, `${label}@${width}: no horizontal overflow`);
        assert.deepEqual(m.overflow, [], `${label}@${width}: no header element escapes the viewport`);
        assert.ok(m.cards.every(c => c.h <= 72), `${label}@${width}: compact cards`);
        if (label === "owner") {
          assert.deepEqual(m.cards.map(c => c.faces), [3, 2], "owner previews are real fixture relations, capped at three");
          assert.ok(m.edit && m.edit.w >= m.vw - 40, "Edit profile spans the header");
          assert.ok(m.cover.b >= m.edit.b - 1, "cover/fade continues beneath Edit profile");
        } else {
          assert.deepEqual(m.cards.map(c => c.faces), [0, 1], "visitor: no followers -> count-only; one known following shows one real avatar");
          assert.ok(m.follow && m.msg && m.follow.t === m.msg.t, "Follow and Message sit on one row");
        }
        assert.ok(m.meta && m.meta.t > m.cards[0].t, `${label}@${width}: meta row below counts`);
      }
      assert.deepEqual(errors, [], "no page errors");
      await context.close();
    }
    // Every non-GET was intercepted with 503 (nothing reached a server). Only realtime ticket handshakes are expected.
    assert.deepEqual([...new Set(writes.map(u => new URL(u).pathname))].filter(p => p !== "/api/realtime/ticket"), [], "no profile/relationship writes attempted");
  } finally {
    await browser?.close();
    await server.close();
  }
});
