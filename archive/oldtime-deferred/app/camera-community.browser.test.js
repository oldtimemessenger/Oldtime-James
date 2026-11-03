import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

const fixture = {
  session: "camera-quotes-test",
  settings: { readReceipts: true, lastSeen: "everyone" },
  users: [{
    id: "camera-quotes-test",
    username: "testmember",
    name: "Test Member",
    email: "testmember@example.test",
    password: "test-password",
    avatar: "/app/avatar.svg",
    private: false,
    followers: [],
    following: [],
    friends: ["story-member"],
    closeFriends: ["story-member"],
    interests: [],
    profileVisibility: { city: true, interests: true }
  }, {
    id: "story-member",
    username: "storymember",
    name: "Story Member",
    avatar: "/app/avatar.svg",
    private: false,
    followers: [],
    following: [],
    friends: ["camera-quotes-test"],
    closeFriends: [],
    interests: [],
    profileVisibility: { city: true, interests: true }
  }, {
    id: "story-outsider",
    username: "storyoutsider",
    name: "Story Outsider",
    avatar: "/app/avatar.svg",
    private: false,
    followers: [],
    following: [],
    friends: [],
    closeFriends: [],
    interests: [],
    profileVisibility: { city: true, interests: true }
  }],
  requests: [],
  friendRequests: [],
  posts: [],
  stories: [],
  convos: [{
    id: "primary-chat",
    members: ["camera-quotes-test", "story-member"],
    messages: [{ id: "primary-message", author: "story-member", body: "Primary conversation", created: 1700000000000 }]
  }, {
    id: "request-chat",
    members: ["camera-quotes-test", "story-outsider"],
    messages: [{ id: "request-message", author: "story-outsider", body: "Request conversation", created: 1700000001000 }]
  }, {
    id: "general-chat",
    members: ["camera-quotes-test", "story-member", "story-outsider"],
    group: { name: "General test group" },
    messages: [{ id: "general-message", author: "story-member", body: "General conversation", created: 1700000002000 }]
  }],
  notes: [],
  blocks: [],
  reports: [],
  campaigns: [],
  interests: {},
  resets: []
};

// Keep the older UI flow as reference for later feature ports. The active
// release browser suite runs against the current Oldtime Technologies source.
test.skip("Legacy Oldtime UI: camera library, Quote creation, Community listing, and profile Notes", {
  timeout: 90_000
}, async () => {
  const originalPort = process.env.PORT;
  const originalBasePath = process.env.BASE_PATH;
  process.env.PORT = "5173";
  process.env.BASE_PATH = "/";

  const server = await createServer({
    configFile: resolve(packageRoot, "vite.config.ts"),
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0, strictPort: false }
  });
  let browser;

  try {
    await server.listen();
    const address = server.httpServer.address();
    assert.ok(address && typeof address === "object", "Vite should listen on an available port");

    browser = await chromium.launch({
      executablePath: findChromium(),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking",
        "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
    });
    const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: { width: 402, height: 874 }
    });
    // This isolated rendering regression test has no API service. Real
    // authentication and draft recovery are also checked against the running app.
    const isolateApi=route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"API unavailable in isolated rendering test"})});
    await context.route("**/api/**",isolateApi);
    await context.addInitScript(state => {
      if (!localStorage.getItem("oldtime-v1")) {
        localStorage.setItem("oldtime-v1", JSON.stringify(state));
      }
      sessionStorage.clear();
      sessionStorage.setItem("oldtime-cloud-session-v1",JSON.stringify({
        account:{id:state.session},accessToken:"isolated-test-session",expiresAt:Date.now()+600_000
      }));
      window.__getUserMediaCalls = 0;
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            window.__getUserMediaCalls++;
            throw new DOMException("Camera permission denied for this test", "NotAllowedError");
          }
        }
      });
    }, fixture);

    const page = await context.newPage();
    page.on("dialog",dialog=>dialog.accept());
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "networkidle" });
    await page.locator("#create-open").waitFor({ state: "visible" });
    assert.deepEqual(
      await page.locator(".nav:not(.nav-hidden) > button").evaluateAll(buttons => buttons.map(button => button.innerText.trim())),
      ["Home", "Blast", "Create", "Chat", "Profile"],
      "Create sits in the center of the primary navigation"
    );
    assert.equal(await page.locator('.nav [data-tab="blast"]').getAttribute("aria-label"), "Blast");
    assert.equal(await page.locator(".nav").evaluate(element => getComputedStyle(element).backgroundColor), "rgb(9, 10, 12)");

    await page.locator('.nav [data-tab="chat"]').click();
    await page.locator(".chat-list-screen").waitFor({ state: "visible" });
    assert.equal(await page.locator("#crows .chat-inbox-row").count(), 3,
      "All chats should include Primary, Requests, and General conversations by default");
    await page.setViewportSize({ width: 470, height: 874 });
    const initialInboxMenu = await page.locator("#chat-more-menu").evaluate(element => ({
      hidden: element.hidden,
      display: getComputedStyle(element).display,
      menuTextVisible: element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0
    }));
    assert.equal(initialInboxMenu.hidden, true, "filter menu must start closed on the Messages landing screen");
    assert.equal(initialInboxMenu.display, "none", "closed filter menu must not leak into the Messages header");
    assert.equal(initialInboxMenu.menuTextVisible, false, "closed filter menu content must not be visible");
    for (const width of [320, 402, 430, 470, 980]) {
    await page.setViewportSize({ width, height: 874 });
    await page.locator("#chat-filter-open").click();
    await page.locator("#chat-more-menu").waitFor({ state: "visible" });
    const mobileFilterSheet = await page.locator("#chat-more-menu").evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {
        position: getComputedStyle(element).position,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        backdrop: getComputedStyle(document.querySelector("#chat-options-backdrop")).display
      };
    });
    assert.equal(mobileFilterSheet.position, "fixed", "mobile-width filter menu should use a bottom sheet");
    assert.ok(mobileFilterSheet.left >= 0 && mobileFilterSheet.right <= mobileFilterSheet.viewportWidth + 1,
      "filter sheet should fit the full mobile layout viewport");
    assert.ok(mobileFilterSheet.top >= 0,
      `filter sheet must not be clipped above the Messages header at ${width}px`);
    assert.ok(Math.abs(mobileFilterSheet.width - mobileFilterSheet.viewportWidth) <= 1,
      `filter sheet must use the viewport width, not the header button width at ${width}px`);
    assert.ok(Math.abs(mobileFilterSheet.bottom - mobileFilterSheet.viewportHeight) <= 1,
      `filter sheet must attach to the bottom of the viewport, not the header at ${width}px`);
    assert.equal(mobileFilterSheet.backdrop, "block", "open filter sheet should dim the page behind it");
    await page.keyboard.press("Escape");
    await page.locator("#chat-more-menu").waitFor({ state: "hidden" });
    }

    await page.setViewportSize({ width: 402, height: 874 });
    for (const folder of ["primary", "requests", "general"]) {
      const tab = page.locator(`.chat-inbox-tabs [data-inbox-folder="${folder}"]`);
      await tab.click();
      assert.equal(await tab.getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator("#crows .chat-inbox-row").count(), 1,
        `${folder} should show only its matching conversation`);
    }
    await page.locator("#chat-filter-open").click();
    await page.locator("#chat-more-menu").waitFor({ state: "visible" });
    await page.locator('[data-more-filter="all"]').click();
    assert.equal(await page.locator("#chat-filter-open").getAttribute("aria-current"), "page");
    assert.equal(await page.locator("#crows .chat-inbox-row").count(), 3,
      "choosing All chats should leave the folder scope and restore every conversation");
    await page.locator("#chat-filter-open").click();
    await page.locator("#chat-more-menu").waitFor({ state: "visible" });
    await page.locator('[data-more-filter="unanswered"]').click();
    assert.equal(await page.locator('[data-more-filter="unanswered"]').getAttribute("aria-checked"), "true");
    for (const width of [402, 360, 320]) {
      await page.setViewportSize({ width, height: 874 });
      const layout = await page.locator(".chat-inbox-toolbar").evaluate(element => ({
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        width: element.clientWidth,
        scroll: element.scrollWidth,
        viewport: window.innerWidth,
      }));
      assert.ok(layout.scroll <= layout.width + 1, `Messages tabs do not overflow at ${width}px`);
      assert.ok(layout.left >= 0 && layout.right <= layout.viewport + 1, `Messages toolbar fits the viewport at ${width}px`);
    }
    await page.locator('.nav [data-tab="blast"]').click();
    await page.locator(".blast-screen.bvn-twitter-feed").waitFor({ state: "visible" });
    assert.deepEqual(
      (await page.locator(".bvn-tabs button").allTextContents()).map(label => label.trim()),
      ["For you", "Following", "Communities"],
      "Community has one shared navigation row"
    );
    assert.equal(await page.locator(".bvn-header h1").innerText(), "Community");
    assert.ok(await page.getByTestId("community-messages").isVisible(), "private video-note messages remain directly accessible");
    assert.equal(await page.locator(".bvn-feed-scopes").count(), 0, "there is no duplicate feed-scope row");
    assert.equal(await page.locator(".blast-screen.blast-hub").count(), 0, "the separate Posts feed is removed from the route");
    assert.equal(await page.locator(".blast-stories-section").count(), 1);
    assert.equal(await page.locator(".blast-discover-strip").count(), 1);
    await page.locator(".bvn-tabs [data-bvn-feed-scope='for-you']").waitFor({ state: "visible" });
    assert.equal(await page.locator(".bvn-feed-filters").count(), 0, "the redundant six-option filter row is removed");
    await page.getByTestId("community-messages").click();
    await page.locator(".bvn-page-heading h2").getByText("Messages").waitFor({ state: "visible" });
    await page.locator(".bvn-tabs [data-bvn-open-feed='for-you']").click();
    await page.locator(".bvn-twitter-feed").waitFor({ state: "visible" });
    await page.locator(".bvn-tabs [data-bvn-feed-scope='following']").click();
    assert.equal(await page.locator(".bvn-tabs [data-bvn-feed-scope='following']").getAttribute("aria-pressed"), "true");
    await page.locator(".bvn-tabs [data-bvn-feed-scope='for-you']").click();
    assert.equal(await page.locator(".bvn-tabs [data-bvn-feed-scope='for-you']").getAttribute("aria-pressed"), "true");
    for (const width of [402, 360, 320]) {
      await page.setViewportSize({ width, height: 874 });
      const layout = await page.evaluate(() => {
        const bounds = selector => {
          const element = document.querySelector(selector);
          const rect = element?.getBoundingClientRect();
          return rect && { left: rect.left, right: rect.right, width: rect.width };
        };
        return {
          viewport: window.innerWidth,
          composer: bounds(".bvn-content-composer"),
          prompt: bounds(".bvn-compose-prompt"),
          scope: bounds(".bvn-tabs"),
          search: bounds(".bvn-feed-search"),
        };
      });
      assert.ok(layout.composer?.right <= layout.viewport + 1, `Composer fits at ${width}px`);
      assert.ok(layout.prompt?.right <= layout.viewport + 1, `Post composer fits at ${width}px`);
      assert.ok(layout.scope?.right <= layout.viewport + 1, `Feed scope tabs fit at ${width}px`);
      assert.ok(layout.search?.right <= layout.viewport + 1, `Unified search fits at ${width}px`);
    }
    await page.setViewportSize({ width: 402, height: 874 });
    await page.setViewportSize({ width: 1280, height: 900 });
    const desktopBlast = await page.evaluate(() => {
      const phone = document.querySelector(".phone");
      const sidebar = document.querySelector(".blast-x-sidebar");
      const timeline = document.querySelector(".blast-screen.bvn-twitter-feed");
      const rightRail = document.querySelector(".blast-x-right-rail");
      const rect = element => {
        const bounds = element?.getBoundingClientRect();
        return bounds && { left: bounds.left, right: bounds.right };
      };
      return {
        wide: phone?.classList.contains("blast-wide-phone"),
        sidebarDisplay: getComputedStyle(sidebar).display,
        rightRailDisplay: getComputedStyle(rightRail).display,
        sidebar: rect(sidebar),
        timeline: rect(timeline),
        rightRail: rect(rightRail),
        viewport: window.innerWidth,
        discoverDisplay: getComputedStyle(document.querySelector(".bvn-screen .blast-discover-strip")).display
      };
    });
    assert.equal(desktopBlast.wide, true, "Blast uses the wide web workspace");
    assert.equal(desktopBlast.sidebarDisplay, "flex", "desktop navigation is visible");
    assert.equal(desktopBlast.rightRailDisplay, "grid", "the discovery rail is visible");
    assert.ok(desktopBlast.sidebar.right <= desktopBlast.timeline.left + 1, "sidebar sits beside the timeline");
    assert.ok(desktopBlast.timeline.right <= desktopBlast.rightRail.left + 1, "discovery rail sits beside the timeline");
    assert.ok(desktopBlast.rightRail.right <= desktopBlast.viewport, "the three-column layout stays within the viewport");
    assert.equal(desktopBlast.discoverDisplay, "none", "the desktop discovery rail is not duplicated inside the feed");
    await page.setViewportSize({ width: 402, height: 874 });
    await page.locator('.bvn-tabs [data-blast-nav="communities"]').click();
    await page.locator(".blast-community-list").waitFor({ state: "visible" });
    assert.equal(await page.locator(".blast-community-card").count(), 6);
    const communityDirectoryTabs = (await page.locator(".blast-community-directory-tabs [role='tab']").allTextContents()).map(label => label.trim());
    assert.equal(communityDirectoryTabs.length, 2, "the directory has only discovery and joined views");
    assert.equal(communityDirectoryTabs[0], "Discover");
    assert.match(communityDirectoryTabs[1], /^Joined(?:\s+\d+)?$/);
    assert.equal(await page.locator('[data-blast-community-directory="people"]').count(), 0, "people discovery is consolidated under Friends & requests");
    await page.locator('[data-blast-community-scope="discover"]').click();
    await page.locator('[data-blast-community-join="everyday-life"]').click();
    await page.locator('[data-blast-community-join="everyday-life"][aria-pressed="true"]').waitFor({ state: "visible" });
    await page.locator('[data-blast-community-open="everyday-life"]').click();
    await page.locator(".blast-community-detail-card").waitFor({ state: "visible" });
    await page.locator('[data-blast-community-post="everyday-life"]').first().click();
    await page.locator("#blast-create-form").waitFor({ state: "visible" });
    await page.locator("#blast-body").fill("A real post in a joined community");
    await page.locator('[data-testid="blast-submit"]').click();
    await page.locator(".blast-community-detail-card").waitFor({ state: "visible" });
    assert.equal(await page.locator(".blast-post-copy").filter({ hasText: "A real post in a joined community" }).count(), 1);
    await page.locator('.blast-community-tabs [data-blast-nav="notes"]').click();
    await page.locator(".bvn-twitter-feed").waitFor({ state: "visible" });
    await page.locator(".bvn-feed-entry .blast-post-copy").filter({ hasText: "A real post in a joined community" }).waitFor({ state: "visible" });
    assert.equal(await page.locator(".bvn-device-note").count(), 0);
    assert.doesNotMatch(await page.locator(".bvn-twitter-feed").innerText(), /on this device|sync to other devices/i);
    await page.locator(".bvn-feed-search input").fill("A real post in a joined community");
    await page.locator(".bvn-feed-search button").click();
    await page.locator(".bvn-feed-entry .blast-post-copy").filter({ hasText: "A real post in a joined community" }).waitFor({ state: "visible" });
    assert.equal(await page.locator(".bvn-feed-entry").count(), 1, "search filters the combined text/video feed without opening a new screen");
    if (process.env.OLDTIME_THEME_SCREENSHOTS) {
      await page.screenshot({ path: "/tmp/oldtime-blast-clean-copy.png" });
    }
    await page.getByTestId("blast-settings-open").click();
    await page.locator("[data-blast-settings-drawer]").waitFor({ state: "visible" });
    assert.equal(await page.locator(".bvn-settings-device, .bvn-settings-footnote, .bvn-settings-copy small").count(), 0);
    await page.locator("[data-blast-drawer-close]").click();
    await page.locator(".nav button").first().click();
    await page.locator("#create-open").waitFor({ state: "visible" });

    await page.locator("#create-open").click();
    await page.locator(".ch-page").waitFor({ state: "visible" });
    const hubBounds = await page.locator(".ch-page").boundingBox();
    assert.ok(hubBounds && hubBounds.height >= 700, "Create opens as a full-screen page");
    await page.locator('.ch-row[data-ch="photo"]').click();
    const libraryPicker = page.locator("[data-ch-file]");
    assert.equal(await libraryPicker.getAttribute("accept"), "image/*,video/*");
    assert.equal(await libraryPicker.getAttribute("capture"), null, "the media picker must not force camera capture");
    assert.equal(await page.evaluate(() => window.__getUserMediaCalls), 0, "choosing Main feed does not start the camera");

    await libraryPicker.setInputFiles({
      name: "library-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAmElEQVR4nO3QMREAIBDAsJeNDWxgEmRkoEP2Xmftc382OkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAO0BARgihnO/GDoAAAAASUVORK5CYII=", "base64")
    });
    // Authoritative success state: the camera is closed and a background photo is loaded (the empty-state hint is hidden only when project.background.media is set).
    await page.waitForFunction(() => {
      const editor = document.querySelector(".creative-editor"), canvas = document.querySelector("#ce-canvas");
      return editor && !editor.classList.contains("is-camera-open") && document.querySelector("#ce-empty")?.hidden === true && canvas?.width > 0 && canvas?.height > 0;
    }).catch(async error => {
      throw new Error(`Photo did not become ready. Camera open: ${await page.locator(".creative-editor").evaluate(element => element.classList.contains("is-camera-open"))}; error: ${await page.locator("#ce-error").textContent()}`, { cause: error });
    });
    assert.equal(await page.locator(".creative-editor").evaluate(element => element.classList.contains("is-camera-open")), false);
    assert.ok(await page.locator("#ce-canvas").evaluate(canvas=>canvas.width>0&&canvas.height>0));
    assert.equal(await page.locator(".ce-dock").isVisible(),true);
    assert.equal(await page.evaluate(() => window.__getUserMediaCalls), 0, "selecting a file does not request camera permission");
    if (process.env.OLDTIME_THEME_SCREENSHOTS) {
      await page.screenshot({ path: "/tmp/oldtime-create-theme.png" });
    }

    await page.locator("#ce-close").click(); // Return from the media review canvas to Camera mode.
    await page.locator("#ce-close").click();
    await page.locator("#ce-exit-dialog").waitFor({state:"visible"});
    await page.locator("#ce-exit-discard").click();
    await page.locator(".creative-editor").waitFor({state:"detached"});

    await page.locator("#create-open").click();
    await page.locator('.ch-primary[data-ch="camera"]').click();
    await page.locator(".creative-editor.is-camera-open").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector("#ce-error")?.textContent.trim());
    assert.equal(await page.locator("#ce-canvas").evaluate(canvas => getComputedStyle(canvas).objectFit), "cover", "the full-screen camera preview fills the screen without letterboxing");
    await page.locator("#ce-close").click();
    if (await page.locator("#ce-exit-dialog").isVisible()) await page.locator("#ce-exit-discard").click();
    await page.locator(".creative-editor").waitFor({state:"detached"});

    const cameraCallsBeforeStudio = await page.evaluate(() => window.__getUserMediaCalls);
    await page.locator("#create-open").click();
    await page.locator('.ch-primary[data-ch="studio"]').click();
    await page.locator(".creative-editor.is-studio").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => window.__getUserMediaCalls), cameraCallsBeforeStudio, "Oldtime Studio does not auto-start the camera");
    await page.locator("#ce-close").click();
    await page.locator(".creative-editor").waitFor({state:"detached"});

    await page.locator("#create-open").click();
    await page.locator('.ch-quick[data-ch="quote"]').click();
    await page.locator("#ce-canvas").click();
    await page.locator("#ce-inline-text").fill("A text-only camera Quote");
    assert.equal(await page.locator("#ce-inline-text").evaluate(element=>element===document.activeElement),true);
    await page.locator("#ce-text-done").click();
    await page.locator(".ce-share-menu > summary").click();
    await page.locator("#ce-share-toggle").click();
    await page.locator("#ce-caption").fill("A text-only camera Quote");
    await page.locator("#ce-publish").click();
    await page.waitForFunction(() => {
      const saved = JSON.parse(localStorage.getItem("oldtime-v1"));
      return saved.posts.some(post => post.caption === "A text-only camera Quote");
    });
    await page.locator(".creative-editor").waitFor({ state: "detached" });
    const cameraQuote = await page.evaluate(() => JSON.parse(localStorage.getItem("oldtime-v1"))
      .posts.find(post => post.caption === "A text-only camera Quote"));
    assert.equal(cameraQuote.kind, "text");
    assert.deepEqual(cameraQuote.media, []);

    await page.locator(".nav button").first().click();
    await page.locator("#create-open").waitFor({ state: "visible" });
    await page.locator("#create-open").click();
    await page.locator('.ch-quick[data-ch="quote"]').click();
    await page.locator("#ce-canvas").click();
    await page.locator("#ce-inline-text").fill("A photo-backed quote card");
    await page.locator("#ce-text-done").click();
    await page.locator("#ce-quote-photo").waitFor({ state: "visible" });
    await page.locator("#ce-quote-photo").click();
    await page.locator("#ce-upload").setInputFiles({
      name: "quote-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAmElEQVR4nO3QMREAIBDAsJeNDWxgEmRkoEP2Xmftc382OkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAO0BARgihnO/GDoAAAAASUVORK5CYII=", "base64")
    });
    await page.locator(".ce-share-menu > summary").click();
    await page.locator("#ce-share-toggle").click();
    await page.locator("#ce-caption").fill("A photo-backed quote card");
    await page.locator("#ce-publish").click();
    await page.waitForFunction(() => {
      const saved = JSON.parse(localStorage.getItem("oldtime-v1"));
      return saved.posts.some(post => post.caption === "A photo-backed quote card" && post.media?.length === 1);
    });
    await page.locator(".creative-editor").waitFor({ state: "detached" });
    const photoQuote = await page.evaluate(() => JSON.parse(localStorage.getItem("oldtime-v1"))
      .posts.find(post => post.caption === "A photo-backed quote card"));
    assert.equal(photoQuote.kind, "text");
    assert.equal(photoQuote.text, "A photo-backed quote card");
    assert.equal(photoQuote.media.length, 1);

    await page.locator('.nav [data-tab="profile"]').click();
    await page.locator("#profile-note").click();
    await page.locator("#note-text").fill("A note above my photo");
    await page.locator("#save-note").click();
    await page.locator("#profile-note").waitFor({ state: "visible" });
    assert.equal((await page.locator("#profile-note").innerText()).trim(), "A note above my photo");
    const notePlacement = await page.evaluate(() => {
      const note = document.querySelector("#profile-note").getBoundingClientRect();
      const photo = document.querySelector(".profile-avatar").getBoundingClientRect();
      return { noteBottom: note.bottom, photoTop: photo.top };
    });
    assert.ok(notePlacement.noteBottom < notePlacement.photoTop, "the saved Note should sit above the profile photo");
    assert.equal(await page.locator(".profile-screen").evaluate(element => getComputedStyle(element).backgroundColor), "rgb(255, 255, 255)");
    await page.locator('[data-testid="quote-strip"] [data-quote-open]').first().click();
    await page.locator('[data-testid="quote-viewer"]').waitFor({ state: "visible" });
    assert.match(await page.locator(".ot-authored-quote blockquote").innerText(), /.+/);
    await page.locator("[data-quote-next]").first().click();
    await page.locator("[data-quote-close]").first().click();
    await page.locator("[data-collection-create]").first().click();
    await page.locator("#ot-collection-title").fill("Weekend memory");
    await page.locator("#ot-collection-description").fill("A few moments from the weekend.");
    await page.locator("#ot-collection-type").selectOption("memory");
    await page.locator('[data-cover-template="red"]').click();
    await page.locator(".ot-collection-choice input").first().check();
    await page.locator("#ot-collection-save").click();
    await page.locator('[data-testid="collection-grid"]').waitFor({ state: "visible" });
    assert.match(await page.locator(".ot-collection-description").innerText(), /A few moments from the weekend/);
    await page.locator(".ot-collection-detail-cover .is-red").waitFor({ state: "visible" });
    assert.equal(await page.locator("[data-collection-item]").count(), 1);
    await page.locator("[data-collection-close]").click();
    await page.locator("[data-post-cover-edit]").first().click();
    await page.locator('[data-cover-template="night"]').click();
    await page.locator("#ot-post-cover-save").click();
    await page.locator(".hookcard-open .ot-profile-cover-template.is-night").waitFor({ state: "visible" });
    assert.equal(await page.locator(".profile-name").evaluate(element => getComputedStyle(element).color), "rgb(22, 24, 35)");
    for (const [selector, background, foreground] of [
      ["#edit", "rgb(15, 20, 25)", "rgb(255, 255, 255)"],
      ["#logout", "rgb(240, 241, 243)", "rgb(23, 25, 29)"],
      ["#playall", "rgb(42, 42, 42)", "rgb(255, 255, 255)"]
    ]) {
      const buttonStyle = await page.locator(selector).evaluate(element => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, foreground: style.color, height: element.getBoundingClientRect().height };
      });
      assert.equal(buttonStyle.background, background, `${selector} profile button background`);
      assert.equal(buttonStyle.foreground, foreground, `${selector} profile button contrast`);
      assert.ok(buttonStyle.height >= 40 && buttonStyle.height <= 46, `${selector} should keep its compact profile size`);
    }
    assert.equal(await page.locator(".profile-page").evaluate(element => element.scrollWidth <= element.clientWidth), true);
    if (process.env.OLDTIME_THEME_SCREENSHOTS) {
      await page.screenshot({ path: "/tmp/oldtime-profile-theme.png" });
    }

    await page.setViewportSize({ width:402, height:650 });
    await page.locator("#edit").click();
    for (const selector of ["#savep-header", "#savep"]) {
      const placement = await page.locator(selector).evaluate(button => {
        const rect = button.getBoundingClientRect();
        const nav = document.querySelector(".nav").getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return {
          visible: rect.top >= 0 && rect.bottom <= nav.top,
          clickable: hit === button || button.contains(hit),
          background: getComputedStyle(button).backgroundColor
        };
      });
      assert.ok(placement.visible, `${selector} must stay above bottom navigation on a short phone`);
      assert.ok(placement.clickable, `${selector} must not be covered by another element`);
      assert.equal(placement.background, "rgb(15, 20, 25)");
    }
    if (process.env.OLDTIME_THEME_SCREENSHOTS) {
      await page.screenshot({ path: "/tmp/oldtime-profile-editor-save.png" });
    }
    await page.locator("#nm").fill("Profile Save Test");
    await page.locator("#bio").fill("Saved from the header");
    await page.locator("#savep-header").click();
    await page.locator(".profile-screen").waitFor({ state:"visible" });
    assert.equal(await page.locator(".profile-name").innerText(), "Profile Save Test");
    await page.reload();
    await page.locator('.nav [data-tab="profile"]').click();
    await page.locator(".profile-screen").waitFor({ state:"visible" });
    assert.equal(await page.locator(".profile-name").innerText(), "Profile Save Test");
    await page.locator("#edit").click();
    assert.equal(await page.locator("#bio").inputValue(), "Saved from the header");
    await page.locator("#city").fill("Test City");
    await page.locator("#savep").click();
    await page.locator(".profile-screen").waitFor({ state:"visible" });
    assert.match(await page.locator(".profile-city").innerText(), /Test City/);
    await page.setViewportSize({ width:402, height:874 });

    await page.locator('.nav [data-tab="updates"]').click();
    await page.locator("#create-open").click();
    await page.locator('.ch-quick[data-ch="quote"]').click();
    await page.locator("#ce-canvas").click();
    await page.locator("#ce-inline-text").fill("Only my Close Friends should see this");
    await page.locator("#ce-text-done").click();
    await page.locator(".ce-share-menu > summary").click();
    await page.locator("#ce-share-toggle").click();
    await page.locator("#ce-destination").selectOption("story");
    await page.locator(".ce-panel .ce-sheet-done").click();
    await page.locator('.ce-menu:has([data-ce-add="sticker"]) > summary').click();
    const mediaBefore=await page.locator("#ce-canvas").boundingBox();
    await page.locator('[data-ce-add="sticker"]').click();
    const mediaWithTray=await page.locator("#ce-canvas").boundingBox();
    const trayGeometry=await page.locator("#ce-sticker-flow").evaluate(element=>({width:element.clientWidth,scrollWidth:element.scrollWidth}));
    assert.ok(mediaBefore&&mediaWithTray);
    assert.ok(Math.abs(mediaBefore.height-mediaWithTray.height)<1,"sticker tray overlays the full-screen canvas");
    assert.ok(trayGeometry.width>0&&trayGeometry.scrollWidth>=trayGeometry.width*2,"library and configuration stay in one horizontal tray");
    await page.locator('.ce-menu:has([data-ce-add="sticker"]) > summary').click();
    await page.locator('[data-ce-add="sticker"]').click();
    await page.locator('[data-ce-sticker="poll"]').click();
    await page.locator("#ce-sticker-value").fill("What should we do next?");
    await page.locator("#ce-sticker-options").fill("Run, Walk");
    await page.locator("#ce-sticker-add").click();
    await page.locator("#ce-sticker-edit-text").fill("Best pace?");
    await page.locator("#ce-sticker-edit-choice-a").fill("Steady");
    await page.locator("#ce-sticker-edit-choice-b").fill("Fast");
    await page.locator(".ce-panel .ce-sheet-done").click();
    await page.locator(".ce-share-menu > summary").click();
    await page.locator("#ce-share-toggle").click();
    await page.locator("#ce-visibility").selectOption("close-friends");
    await page.locator("#ce-publish").click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("oldtime-v1")).stories.some(item=>item.text==="Only my Close Friends should see this"));
    const publishedStory = await page.evaluate(() => JSON.parse(localStorage.getItem("oldtime-v1")).stories.find(item => item.text === "Only my Close Friends should see this"));
    assert.equal(publishedStory.heyWord, undefined);
    const pollSticker=publishedStory.creativeProject.layers.find(layer=>layer.sticker==="poll");
    assert.equal(pollSticker.text,"Best pace?");
    assert.deepEqual(pollSticker.choices,["Steady","Fast"]);
    await page.locator(".nav button").first().click();
    await page.locator('.stories.home-stories [data-story="camera-quotes-test"]').click();
    await page.waitForFunction(() => document.querySelector("#storyview")?.classList.contains("on"));
    await page.locator("#storyview .story-stage").waitFor({ state: "visible" });
    await page.locator("#storyview .story-comment-open").waitFor({ state: "visible" });
    await page.locator("#storyview .story-more-open").click();
    await page.locator("#storyview .story-more-menu").waitFor({ state: "visible" });
    const replyPermission = page.locator("#storyview .story-comment-setting");
    await replyPermission.waitFor({ state: "visible" });
    await replyPermission.selectOption("off");
    await page.locator("#storyview .story-comment-open").waitFor({ state: "hidden" });
    await replyPermission.selectOption("on");
    await page.locator("#storyview .story-comment-open").waitFor({ state: "visible" });
    await page.locator("#storyview #sclose").click();
    await page.waitForFunction(() => !document.querySelector("#storyview")?.classList.contains("on"));
    const savedBrowserState=await context.storageState();
    const viewerContext=async userId=>{
      const viewer=await browser.newContext({serviceWorkers:"block",viewport:{width:402,height:874},storageState:savedBrowserState});
      await viewer.route("**/api/**",isolateApi);
      await viewer.addInitScript(id=>{
        const state=JSON.parse(localStorage.getItem("oldtime-v1"));state.session=id;
        localStorage.setItem("oldtime-v1",JSON.stringify(state));sessionStorage.clear();
        sessionStorage.setItem("oldtime-cloud-session-v1",JSON.stringify({
          account:{id},accessToken:"isolated-test-session",expiresAt:Date.now()+600_000
        }));
      },userId);
      return viewer;
    };
    const memberContext=await viewerContext("story-member"),outsiderContext=await viewerContext("story-outsider");
    const memberPage=await memberContext.newPage(),outsiderPage=await outsiderContext.newPage();
    await memberPage.goto(`http://127.0.0.1:${address.port}/`,{waitUntil:"networkidle"});
    await memberPage.locator('.stories.home-stories [data-story="camera-quotes-test"]').click();
    await memberPage.waitForFunction(()=>document.querySelector("#storyview")?.classList.contains("on"));
    assert.match(await memberPage.locator("#storyview").innerText(),/Only my Close Friends should see this/);
    await outsiderPage.goto(`http://127.0.0.1:${address.port}/`,{waitUntil:"networkidle"});
    assert.equal(await outsiderPage.locator('.stories.home-stories [data-story="camera-quotes-test"]').count(),0);
    assert.equal(await outsiderPage.locator("#storyview").evaluate(element => element.classList.contains("on")), false);
    await memberContext.close();
    await outsiderContext.close();

    await page.locator('.stories.home-stories [data-story="camera-quotes-test"]').click();
    await page.waitForFunction(() => document.querySelector("#storyview")?.classList.contains("on"));

    assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join("; ")}`);
    await context.close();
  } finally {
    await browser?.close();
    await server.close();
    if (originalPort === undefined) delete process.env.PORT;
    else process.env.PORT = originalPort;
    if (originalBasePath === undefined) delete process.env.BASE_PATH;
    else process.env.BASE_PATH = originalBasePath;
  }
});

