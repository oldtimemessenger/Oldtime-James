// Real-app Community verification: boots the actual Vite app, fakes the cloud API in-browser,
// aborts every request that leaves 127.0.0.1, and records every mutation the app attempts.
// Run: NODE_ENV=test node --test --test-timeout=240000 app/community-composer.browser.test.js
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const which = command => { try { return execFileSync("which", [command], { encoding: "utf8" }).trim(); } catch { return ""; } };
const chromiumPath = [process.env.CHROMIUM_PATH, "/repl/tools/bin/chromium", "/usr/bin/chromium"].find(p => p && existsSync(p)) || which("chromium");
const ffmpeg = which("ffmpeg");

function makeAssets() {
  const dir = mkdtempSync(join(tmpdir(), "oldtime-community-"));
  execFileSync(ffmpeg, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=30", "-t", "0.8",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30", "-profile:v", "baseline", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-an", join(dir, "clip.mp4")]);
  const colors = ["0x1456d9", "0xe0245e", "0x2f9e6b", "0xf2a516"];
  colors.forEach((c, i) => execFileSync(ffmpeg, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=${c}:size=64x48`, "-frames:v", "1", join(dir, `p${i}.png`)]));
  return { mp4: readFileSync(join(dir, "clip.mp4")), pngs: colors.map((_, i) => readFileSync(join(dir, `p${i}.png`))) };
}

const ME = "camera-quotes-test";
const fixture = {
  session: ME, settings: { readReceipts: true, lastSeen: "everyone" },
  users: [{ id: ME, username: "testmember", name: "Test Member", email: "t@example.test", password: "x", avatar: "/app/avatar.svg",
    private: false, followers: [], following: [], friends: [], closeFriends: [], interests: [], profileVisibility: { city: true, interests: true } },
  { id: "travel-e", username: "travele", name: "Travel E", avatar: "/app/avatar.svg", private: false, followers: [], following: [],
    friends: [], closeFriends: [], interests: [], profileVisibility: { city: true, interests: true } }],
  requests: [], friendRequests: [], posts: [], stories: [], convos: [], notes: [], blocks: [], reports: [], campaigns: [], interests: {}, resets: [],
};

test("Community composer, single-video card, grid and viewer work in the real app", {
  skip: (!chromiumPath && "Chromium not available") || (!ffmpeg && "ffmpeg not available to build real media"), timeout: 240_000,
}, async () => {
  const { mp4, pngs } = makeAssets();
  const videoUrl = `data:video/mp4;base64,${mp4.toString("base64")}`;
  const pngUrl = i => `data:image/png;base64,${pngs[i % pngs.length].toString("base64")}`;
  process.env.PORT = "5173"; process.env.BASE_PATH = "/";
  const server = await createServer({ configFile: resolve(packageRoot, "vite.config.ts"), logLevel: "silent", server: { host: "127.0.0.1", port: 0 } });
  let browser;
  let debugPage = null;
  try {
    await server.listen();
    const { port } = server.httpServer.address();
    const origin = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({ executablePath: chromiumPath, headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking", "--autoplay-policy=no-user-gesture-required"] });
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });

    const now = Date.now();
    const videoPost = {
      id: "community-solo-video", sourceId: null, destination: "community", text: "Stairs down to the water", visibility: "public",
      media: [{ id: "solo-media", contentType: "video/mp4", reference: videoUrl }],
      createdAt: now - 2 * 86_400_000, author: { id: "travel-e", username: "travele", displayName: "Travel E", joinedAt: now - 9e9 },
      likeCount: 1, likedByMe: false, likedBy: [], commentCount: 0, saveCount: 0, repostCount: 0, repostedByMe: false, repostNote: null,
      place: { id: "custom:greece", label: "Greece", source: "custom" }, location: "Greece", sportsCard: null,
    };
    const feedPosts = [videoPost];
    const offsite = [];
    const mutations = [];
    const reservations = new Map(); // id -> { attempts, contentType }
    let failNextReservationIndex = 2; // third distinct upload fails once
    let failNextPublish = true;
    const publishBodies = [];
    const publishKeys = [];

    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
      if (url.hostname === "fonts.googleapis.com" && url.pathname === "/css2") {
        return route.fulfill({ status: 200, contentType: "text/css", body: "/* use the browser's local emoji font in this isolated test */" });
      }
      if (url.origin !== origin) { offsite.push(`${route.request().method()} ${url.href}`); return route.abort(); }
      return route.fallback();
    });
    await context.route("**/api/**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (method !== "GET" && method !== "HEAD") mutations.push(`${method} ${url.pathname}`);
      if (url.pathname === "/api/community/preferences" && method === "GET") {
        return json(200, { preferences: { pinned: ["following", "discover", "popular", "friends"], filters: {}, mutedWords: [], mutedAccounts: [], caughtUp: {} }, mutedAccounts: [] });
      }
      if (url.pathname === "/api/community/lists" && method === "GET") return json(200, { lists: [] });
      if (url.pathname === "/api/community/feed" && method === "GET") return json(200, { posts: feedPosts, hasMore: false, nextOffset: feedPosts.length });
      if (url.pathname === "/api/feed" && method === "GET") {
        const surface = url.searchParams.get("surface");
        return json(200, { posts: surface?.startsWith("community") ? feedPosts : [], hasMore: false, nextOffset: feedPosts.length });
      }
      const upload = url.pathname.match(/^\/api\/media\/([0-9a-f-]{36})\/upload$/);
      if (upload && method === "POST") {
        const id = upload[1];
        const body = request.postDataJSON();
        const record = reservations.get(id) || { attempts: 0, ok: 0, contentType: body.contentType, order: reservations.size };
        record.attempts++;
        reservations.set(id, record);
        if (record.order === failNextReservationIndex) {
          failNextReservationIndex = -1;
          return json(429, { error: "Upload temporarily unavailable. Try again." });
        }
        record.ok++;
        assert.match(body.sha256, /^[0-9a-f]{64}$/, "fixed-id uploads send a real SHA-256 digest");
        return json(201, { ready: true, ...(String(body.contentType).startsWith("video/") ? { thumbnailId: crypto.randomUUID() } : {}) });
      }
      if (/^\/api\/media\/[0-9a-f-]{36}\/thumbnail$/.test(url.pathname) && method === "PUT") {
        return json(200, { attached: true });
      }
      if (url.pathname === "/api/posts" && method === "POST") {
        const body = request.postDataJSON();
        publishKeys.push(request.headers()["idempotency-key"] || "");
        if (failNextPublish) { failNextPublish = false; return json(503, { error: "Publishing is briefly unavailable." }); }
        publishBodies.push(body);
        const post = {
          id: "community-new-mixed", sourceId: null, destination: body.destination, text: body.text, visibility: "public",
          media: body.mediaIds.map((id, i) => {
            const type = reservations.get(id)?.contentType || "image/png";
            return { id, contentType: type, reference: type.startsWith("video/") ? videoUrl : pngUrl(i) };
          }),
          createdAt: Date.now(), author: { id: ME, username: "testmember", displayName: "Test Member", joinedAt: now - 9e9 },
          likeCount: 0, likedByMe: false, likedBy: [], commentCount: 0, repostCount: 0, repostedByMe: false, repostNote: null, place: null, sportsCard: null,
        };
        feedPosts.unshift(post);
        return json(201, { post });
      }
      return json(503, { error: "API unavailable in isolated Community test" });
    });
    await context.addInitScript(state => {
      if (!localStorage.getItem("oldtime-v1")) localStorage.setItem("oldtime-v1", JSON.stringify(state));
      sessionStorage.clear();
      sessionStorage.setItem("oldtime-cloud-session-v1", JSON.stringify({ account: { id: state.session }, accessToken: "a".repeat(43), expiresAt: Date.now() + 600_000 }));
    }, fixture);

    const page = await context.newPage();
    debugPage = page;
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.locator('.nav [data-tab="communities"]').click();
    const card = page.locator('[data-testid="card-community-post-community-solo-video"]');
    await card.waitFor({ state: "visible" });

    // --- Single-video card (real communityPostCard markup) ---
    assert.equal(await card.evaluate(el => el.classList.contains("community-video-card")), true);
    const panelText = await card.locator(".cvc-panel").innerText();
    assert.match(panelText, /Travel E/); assert.match(panelText, /2d/); assert.match(panelText, /Greece/);
    assert.match(panelText, /Be the first to comment/);
    for (const action of ["data-like", "data-comment", "data-share"]) assert.equal(await card.locator(`[${action}]`).count() >= 1, true, action);
    const sound = card.locator("[data-community-sound]");
    assert.equal(await sound.getAttribute("aria-pressed"), "false");
    assert.equal(await card.locator("video").evaluate(v => v.muted), true, "video starts muted");
    await sound.click();
    assert.equal(await sound.getAttribute("aria-pressed"), "true");
    assert.equal(await sound.getAttribute("aria-label"), "Mute sound");
    assert.equal(await card.locator("video").evaluate(v => v.muted), false, "toggle unmutes the card video");
    await sound.click();
    assert.equal(await card.locator("video").evaluate(v => v.muted), true, "toggle mutes again");

    const overflow = async () => page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: window.innerWidth,
      wide: [...document.querySelectorAll(".community-post-card, .cvc-panel, .community-attachment-grid, .community-note-panel, .community-note-attachments")]
        .filter(el => el.getBoundingClientRect().right > window.innerWidth + 0.5).map(el => el.className) }));
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 780 });
      const o = await overflow();
      assert.ok(o.doc <= o.vw, `no page overflow at ${width}`); assert.deepEqual(o.wide, [], `no element overflow at ${width}`);
      if (process.env.OLDTIME_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.OLDTIME_SCREENSHOT_DIR}/community-video-card-${width}.png` });
    }

    // Tapping the media opens the existing full-screen viewer at that post.
    await card.locator(".cvc-media").click();
    await page.locator('.clip.post-detail[data-id="community-solo-video"]').waitFor({ state: "visible" });
    await page.locator("#post-viewer-back").click();
    await page.locator(".community-screen").waitFor({ state: "visible" });

    // --- Composer: six mixed files, refusal messages, reorder/remove ---
    const composeButton = page.locator(".community-header [data-cf-compose], .community-header #community-note-open");
    await composeButton.click();
    await page.locator(".community-note-panel").waitFor({ state: "visible" });
    assert.equal(await composeButton.count(), 1, "the Community composer trigger remains available");
    await page.locator("#community-note-input").fill("Six from the island");
    const file = (name, mimeType, buffer) => ({ name, mimeType, buffer });
    const picks = [file("a.png", "image/png", pngs[0]), file("b.mp4", "video/mp4", mp4), file("c.png", "image/png", pngs[1]),
      file("d.png", "image/png", pngs[2]), file("e.mp4", "video/mp4", mp4), file("f.png", "image/png", pngs[3]),
      file("g-extra.png", "image/png", pngs[0]), file("notes.txt", "text/plain", Buffer.from("x"))];
    await page.locator("#community-note-image").setInputFiles(picks);
    const items = page.locator("#community-note-attachments > li");
    assert.equal(await items.count(), 6, "six attachments accepted");
    assert.deepEqual(await items.evaluateAll(list => list.map(li => li.dataset.kind)), ["photo", "video", "photo", "photo", "video", "photo"]);
    const refusal = await page.locator("#community-note-error").innerText();
    assert.match(refusal, /up to 6/); assert.match(refusal, /g-extra\.png/); assert.match(refusal, /notes\.txt/);
    assert.equal(await page.locator("#community-note-attach-count").innerText(), "6 / 6");
    assert.equal(await page.locator("#community-note-image").isDisabled(), true, "picker disabled at the limit");
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 780 });
      const o = await overflow();
      assert.ok(o.doc <= o.vw, `composer no overflow at ${width}`); assert.deepEqual(o.wide, []);
      if (process.env.OLDTIME_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.OLDTIME_SCREENSHOT_DIR}/community-composer-${width}.png` });
    }
    // remove #3 (photo c), then move the last (photo f) earlier, then re-add one photo so we publish six.
    await page.locator('[data-attach-remove="2"]').click();
    assert.equal(await items.count(), 5);
    await page.locator('[data-attach-move="4"][data-dir="-1"]').click();
    assert.deepEqual(await items.evaluateAll(list => list.map(li => li.dataset.kind)), ["photo", "video", "photo", "photo", "video"]);
    await page.locator("#community-note-image").setInputFiles([file("h.png", "image/png", pngs[1])]);
    assert.equal(await items.count(), 6);
    const expectedKinds = ["photo", "video", "photo", "photo", "video", "photo"];
    assert.deepEqual(await items.evaluateAll(list => list.map(li => li.dataset.kind)), expectedKinds);

    // --- Attempt 1: third upload fails -> composer stays with text + attachments ---
    await page.locator("#community-note-submit").click();
    await page.locator("#community-note-error").filter({ hasText: /unavailable|could not|try/i }).waitFor({ timeout: 90_000 });
    assert.equal(await page.locator(".community-note-panel").isVisible(), true, "composer retained after failed upload");
    assert.equal(await page.locator("#community-note-input").inputValue(), "Six from the island");
    assert.equal(await items.count(), 6, "attachments retained after failed upload");
    assert.equal(publishBodies.length, 0);
    assert.equal(publishKeys.length, 0, "failed attachment upload stops before publishing");
    // --- Attempt 2: uploads finish, publish fails once -> still retained ---
    await page.locator("#community-note-submit").click();
    await page.waitForFunction(() => {
      const button = document.querySelector("#community-note-submit");
      return !button || button.dataset.busy !== "true";
    }, null, { timeout: 90_000 });
    const publishError = await page.locator("#community-note-error").textContent().catch(() => "");
    assert.equal(publishKeys.length, 1, `expected one failed publish request; error=${publishError}; requests=${mutations.join(", ")}`);
    assert.match(publishError || "", /Publishing is briefly unavailable/, `unexpected publish error: ${publishError}`);
    assert.equal(await page.locator(".community-note-panel").isVisible(), true, "composer retained after failed publish");
    assert.equal(await items.count(), 6);
    assert.equal(publishKeys.length, 1, "one publish attempt failed and the draft remains");
    // --- Attempt 3: succeeds ---
    await page.locator("#community-note-submit").click();
    await page.locator(".community-note-panel").waitFor({ state: "hidden", timeout: 90_000 });

    assert.equal(publishBodies.length, 1, "post published exactly once");
    const body = publishBodies[0];
    assert.equal(body.destination, "community");
    assert.equal(body.mediaIds.length, 6);
    assert.equal(new Set(body.mediaIds).size, 6, "six unique media IDs");
    assert.deepEqual(body.mediaIds.map(id => reservations.get(id)?.contentType.startsWith("video/") ? "video" : "photo"), expectedKinds, "payload keeps the reordered order");
    for (const id of body.mediaIds) assert.equal(reservations.get(id).ok, 1, `media ${id} confirmed exactly once (no re-upload on retry)`);
    assert.equal(publishKeys.length, 2); assert.ok(publishKeys[0] && publishKeys[0] === publishKeys[1], "publish retry reuses its idempotency key");

    // --- Mixed post renders as a grid with play badges, no repeated author per tile ---
    const mixed = page.locator('[data-testid="card-community-post-community-new-mixed"]');
    await mixed.waitFor({ state: "visible" });
    assert.equal(await mixed.locator(".community-grid-tile").count(), 6);
    assert.equal(await mixed.locator(".community-grid-tile.is-video .community-grid-play").count(), 2);
    assert.equal(await mixed.locator(".community-post-identity").count(), 1);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 780 });
      const o = await overflow();
      assert.ok(o.doc <= o.vw, `feed no overflow at ${width}`); assert.deepEqual(o.wide, []);
      if (process.env.OLDTIME_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.OLDTIME_SCREENSHOT_DIR}/community-feed-${width}.png` });
    }
    // Tap the fourth tile -> viewer opens at index 3.
    await mixed.locator('.community-grid-tile[data-media-index="3"]').click();
    const viewer = page.locator('.clip.post-detail[data-id="community-new-mixed"]');
    await viewer.waitFor({ state: "visible" });
    assert.equal(await viewer.locator('[data-dot="community-new-mixed:3"]').getAttribute("aria-pressed"), "true", "viewer starts at tapped attachment");
    if (process.env.OLDTIME_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.OLDTIME_SCREENSHOT_DIR}/community-viewer.png` });

    assert.deepEqual(offsite, [], "no request left the local test origin");
    const allowed = /^(POST \/api\/media\/[0-9a-f-]{36}\/upload|PUT \/api\/media\/[0-9a-f-]{36}\/thumbnail|DELETE \/api\/media\/[0-9a-f-]{36}|POST \/api\/posts)$/;
    const unexpected = mutations.filter(m => !allowed.test(m));
    if (unexpected.length) console.log("Other intercepted (fake-answered) mutations:", unexpected);
    assert.deepEqual(pageErrors, []);
  } catch (failure) {
    if (process.env.OLDTIME_SCREENSHOT_DIR && debugPage) await debugPage.screenshot({ path: `${process.env.OLDTIME_SCREENSHOT_DIR}/community-failure.png` }).catch(() => {});
    throw failure;
  } finally {
    await browser?.close();
    await server.close();
  }
});
