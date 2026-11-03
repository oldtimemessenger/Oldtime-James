import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const root = css.match(/:root\s*\{([\s\S]*?)\}/)[1];

test("ordinary screens use neutral light backgrounds and dark foregrounds", () => {
  assert.match(root, /--bg:\s*#ffffff;/);
  assert.match(root, /--panel:\s*#f2f4f7;/);
  assert.match(root, /--text:\s*#17191c;/);
  assert.match(root, /--color-primary:\s*#1456d9;/);
  assert.match(root, /--color-burgundy:\s*#8e1b24;/);
  assert.match(css, /html, body, #app\s*\{[^}]*background:\s*var\(--bg\)/);
});

test("profile and existing white screens stay white", () => {
  for (const selector of ["profile-screen", "chat-list-screen", "account-settings-screen", "edit-profile-screen"]) {
    assert.match(css, new RegExp(`\\.${selector}\\s*\\{[^}]*background:\\s*#fff`));
  }
  assert.match(css, /\.profile-nav\s*\{[^}]*background:rgba\(255,255,255/);
  assert.match(css, /\.profile-topbar\s*\{[^}]*color:#fff/);
});

test("video feed foregrounds and bottom navigation remain readable over media", () => {
  assert.match(css, /\.clip\s*\{[^}]*color:#fff/);
  assert.match(css, /\.home-discovery-header\s*\{[^}]*color:#fff/);
  assert.match(css, /\.media-feed-phone > \.nav\s*\{[^}]*background:#090a0c/);
  assert.match(css, /\.media-feed-phone > \.nav button\.on\s*\{[^}]*color:#1456d9/);
  assert.match(app, /\$\{mediaFeedScreen \? "media-feed-phone" : ""\}/);
});

test("bottom navigation uses compact labeled controls and a quiet active state", () => {
  assert.match(css, /\.nav\s*\{[^}]*height:\s*calc\(62px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(css, /\.nav-label\s*\{[^}]*display:block/);
  assert.match(css, /\.nav \.navic\s*\{[^}]*width:24px; height:24px/);
  assert.match(css, /\.nav button\.on\s*\{[^}]*background:var\(--color-surface-secondary\)/);
  assert.match(css, /\.media-feed-phone > \.nav\s*\{[^}]*height:calc\(62px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(css, /\.media-feed-phone > \.nav button\.on\s*\{[^}]*background:rgba\(20,86,217,\.2\)/);
  assert.match(css, /\.nav-profile-avatar\s*\{[^}]*border-radius:50%/);
  assert.match(app, /aria-label="Home">\$\{ic\.home\}<span class="nav-label">Home<\/span>/);
  assert.match(app, /aria-label="Community"[^>]*>\$\{ic\.users\}<span class="nav-label">Community<\/span>/);
  assert.match(app, /aria-label="Messages"[^>]*><span class="nav-message-frame">\$\{ic\.messages\}<span class="nav-unread"/);
  assert.match(app, /<\/span><span class="nav-label">Messages<\/span>/);
  assert.match(app, /class="nav-create-icon"/);
  assert.match(app, /class="nav-profile-frame"/);
});

test("the Create sheet and fields use separate neutral light surfaces", () => {
  assert.match(css, /\.panel\s*\{[^}]*background:\s*var\(--panel\)/);
  assert.match(css, /\.field\s*\{[^}]*background:\s*#f2f4f7[^}]*color:var\(--text\)/);
  assert.match(css, /\.seg button\.on\s*\{[^}]*color:\s*#fff/);
  assert.doesNotMatch(root, /#151c1b|#202a28|#263330/);
});
