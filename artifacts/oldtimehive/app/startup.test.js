import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { finishStartup } from "./startup.js";
import { icons } from "./icons.js";

function openingFixture(t) {
  const classes = new Set();
  const appClasses = new Set();
  const appAttributes = new Set(["inert", "aria-hidden"]);
  const opening = {
    dataset: { started: String(performance.now() - 1000) },
    classList: { add: name => classes.add(name) },
    remove() { this.removed = true; }
  };
  const app = {
    removeAttribute: name => appAttributes.delete(name),
    classList: { add: name => appClasses.add(name) },
  };
  t.mock.method(globalThis, "requestAnimationFrame", callback => callback(), { times: Infinity });
  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: id => id === "oldtime-startup" ? opening : id === "app" ? app : null,
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  return { opening, classes, appClasses, appAttributes };
}

// Node has no requestAnimationFrame; expose it for scoped test mocking.
globalThis.requestAnimationFrame ??= callback => callback();

test("opening completes only when the app signals readiness and releases the app", async t => {
  const fixture = openingFixture(t);
  await finishStartup();
  assert.equal(fixture.opening.dataset.ready, "true");
  assert.ok(fixture.classes.has("is-dismissed"));
  assert.equal(fixture.appAttributes.size, 0);
  assert.ok(fixture.appClasses.has("is-ready"));
  await new Promise(resolve => setTimeout(resolve, 480));
  assert.equal(fixture.opening.removed, true);
});

test("opening uses a compact feather on a uniform blue field with no visible loader", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /src="brand\/oldtime-feather\.png"/);
  assert.match(html, /background:#1456D9/);
  assert.match(html, /width:min\(32vw,148px\); height:min\(25vh,220px\)/);
  assert.match(html, /drop-shadow\(0 0 13px rgba\(185,220,255,\.34\)\)/);
  assert.match(html, /oldtime-feather-arrive \.68s cubic-bezier/);
  assert.doesNotMatch(html, /role="progressbar"|Loading Oldtime|Loading online posts/);
  assert.match(html, /oldtime-startup-status" id="oldtime-startup-status" role="alert" hidden/);
  assert.match(html, /Couldn’t open Oldtime\. Please try again\./);
  assert.match(html, /#app\.oldtime-app\.is-ready/);
  assert.match(html, /@media \(prefers-reduced-motion:reduce\)/);
  const pwaBuild = readFileSync(new URL("../pwa-build.ts", import.meta.url), "utf8");
  assert.match(pwaBuild, /stablePublicFiles\s*=\s*\["brand\/oldtime-feather\.png",\s*"brand\/oldtime-app-icon\.png"\]/);
});

test("the cropped entrance asset has alpha transparency and is smaller than the source canvas", () => {
  const logo = readFileSync(new URL("../public/brand/oldtime-feather.png", import.meta.url));
  assert.deepEqual([...logo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(logo.readUInt32BE(16) < 1152);
  assert.ok(logo.readUInt32BE(20) < 1712);
  assert.equal(logo[25], 6, "PNG should use RGBA color with transparency");
});

test("screen and feed motion runs only on screen changes or newly seen posts", () => {
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(app, /if \(!sameScreen && !communityTabChange\) \{\s*nextScreen\.classList\.add\("motion-screen-enter"\)/);
  assert.match(app, /if \(communityTabChange \|\| item\.matches\("\.community-post-card"\)\) continue;/);
  assert.match(app, /existingFeedEntryKeys\.has\(key\)/);
  assert.match(app, /staggerIndex >= 4/);
  assert.match(css, /\.screen\.motion-screen-enter/);
  assert.match(css, /\.motion-feed-entry/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(app, /feed-loading-skeletons/);
});

test("Search lives in the bottom navigation and Community has no header Search", () => {
  assert.match(icons.search, /<svg/);
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /id="community-search-open"/);
  assert.doesNotMatch(app, /communitiesScreen \? `<button type="button" data-tab="search"/);
  assert.match(app, /requestAnimationFrame\(\(\) => \$\("#q"\)\?\.focus/);
  const nav = app.match(/<nav class="nav \$[\s\S]*?<\/nav>/)?.[0] || "";
  assert.match(nav, /data-tab="communities".*aria-label="Community"/);
  assert.match(nav, /data-tab="search"/);
  assert.doesNotMatch(nav, /data-tab="profile"/);
  assert.match(nav, /aria-label="Home".*<span class="nav-label">Home<\/span>/);
  assert.match(nav, /aria-label="Messages".*<span class="nav-label">Messages<\/span>/);
  assert.match(nav, /class="nav-message-frame"[^>]*>[\s\S]*class="nav-unread"/, "unread count is anchored to the Messages icon");
  assert.doesNotMatch(app, /<button class="icon" data-tab="search"/, "no header Search icon");
  assert.doesNotMatch(nav, /Live/);
  assert.match(nav, /data-tab="chat".*aria-label="Messages"/);
});

test("royal blue applies to primary buttons, not text selection or navigation layout", () => {
  const css = readFileSync(new URL("./brand-selection.css", import.meta.url), "utf8");
  assert.match(css, /background:var\(--color-primary\)/);
  assert.match(css, /color:#fff !important/);
  assert.match(css, /\.phone \.btn:not\(\.ghost\):not\(\.danger\):not\(:disabled\)/);
  assert.doesNotMatch(css, /::selection|--selected-text|\.nav button\.on|\.seg button\.on|\.home-view-tab\.on/);
});

test("production startup survives Vite rewriting the module entry ID", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /getElementById\("oldtime-entry"\)\s*\|\|\s*document\.querySelector\('script\[type="module"\]\[src\]'\)/);
  assert.match(html, /entry\?\.addEventListener\("error", showOpeningError\)/);
});

test("owner profile has a prominent edit action and no dashboard card", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  const editRule = css.match(/\.profile-edit-primary\s*\{([^}]*)\}/)?.[1] || "";
  assert.match(editRule, /min-height:52px/);
  assert.match(editRule, /border-radius:999px/);
  assert.match(editRule, /background:#f5f5f3/);
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  assert.match(app, /class="row profile-primary-actions"/);
  assert.match(app, /class="profile-edit-primary" id="edit" data-testid="button-edit-profile" aria-label="Edit profile"/);
  assert.doesNotMatch(app, /profile-dashboard-card|id="profile-dashboard"/);
});

test("bottom navigation uses consistent visible labels and accessible destinations", () => {
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  const nav = app.match(/<nav class="nav \$[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav);
  assert.match(nav, /aria-label="Home">\$\{ic\.home\}<span class="nav-label">Home<\/span>/);
  assert.ok(nav.includes('aria-label="Community"'));
  assert.ok(nav.includes('<span class="nav-label">Community</span>'));
  assert.match(nav, /aria-label="Messages"><span class="nav-message-frame">\$\{ic\.messages\}[\s\S]*?<span class="nav-label">Messages<\/span>/);
  assert.match(nav, /data-tab="search"[^>]*aria-label="Search"[^>]*>\$\{ic\.search\}<span class="nav-label">Search<\/span>/, "Search takes the old Profile slot");
  assert.doesNotMatch(nav, /data-tab="profile"/);
  assert.doesNotMatch(app, /<button class="icon" data-tab="search"/);
  assert.match(css, /\.nav-label\s*\{[^}]*display:block/);
  assert.match(css, /\.nav-profile-avatar\s*\{[^}]*border-radius:50%/);
  assert.match(app, /class="app-profile-shortcut" data-tab="profile"[\s\S]{0,200}class="nav-profile-frame"[\s\S]{0,120}class="nav-profile-avatar"/, "Profile avatar lives top-left in Home/Community headers");
  assert.match(nav, /class="nav-create-icon"/);
  assert.match(nav, /<span class="nav-label">Create<\/span>/);
  const drawer = app.match(/<div class="drawer-links">[\s\S]*?<\/div>/)?.[0] || "";
  assert.doesNotMatch(drawer, /data-drawer-route="communities"|data-drawer-route="chat"/);
  assert.match(drawer, /data-drawer-route="notes"/);
  assert.match(drawer, /data-drawer-route="settings"/);
});

test("shared mobile sheets stay bounded, scrollable, and clear of safe areas", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(css, /\.sheet\s*\{[^}]*overscroll-behavior:\s*contain/);
  assert.match(css, /\.panel\s*\{[^}]*max-height:min\(92%,760px\)[^}]*overflow:auto[^}]*overscroll-behavior:contain/);
  assert.match(css, /padding:12px 14px calc\(18px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(css, /\.profile-action-sheet\s*\{\s*z-index:\s*1201/);
});

test("auth artwork redesign preserves password forms without adding reference-only providers", () => {
  const markup = readFileSync(new URL("./auth-design.js", import.meta.url), "utf8");
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  for (const id of ["login-form", "email", "pass", "err", "login", "signup", "signup-form", "su-first", "su-last", "su-email", "su-user", "su-birthday", "su-pass", "go", "back"]) {
    assert.ok(markup.includes(`id="${id}"`), `Preserve the existing ${id} control`);
  }
  assert.match(markup, /autocomplete="current-password"/);
  assert.match(markup, /minlength="8"/);
  assert.match(markup, /What’s your name\?/);
  assert.match(app, /What’s your email\?/);
  assert.match(markup, /16 and older/);
  assert.match(markup, /signup-age-note/);
  assert.doesNotMatch(markup, /What’s your gender\?|More options/);
  assert.match(markup, /3–24 letters, numbers, or underscores/);
  assert.doesNotMatch(markup, /id="su-(?:name|bday|bio)"/);
  assert.doesNotMatch(markup, /Send me a code|Continue with Apple|Continue with Google/);
});

test("a ready app is released immediately without an artificial splash delay", async t => {
  const fixture = openingFixture(t);
  fixture.opening.dataset.started = String(performance.now());
  const scheduledDelays = [];
  t.mock.method(globalThis, "setTimeout", (_callback, delay) => {
    scheduledDelays.push(delay);
    return 1;
  });
  await finishStartup();
  assert.equal(fixture.appAttributes.size, 0, "the app must become interactive immediately");
  assert.ok(fixture.appClasses.has("is-ready"));
  assert.deepEqual(scheduledDelays, [460], "only the visual fade-out remains; no minimum wait is scheduled");
});
