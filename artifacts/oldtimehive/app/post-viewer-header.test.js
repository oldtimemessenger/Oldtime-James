import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const detailCss = readFileSync(new URL("./post-detail.css", import.meta.url), "utf8");
const immersiveCss = readFileSync(new URL("./post-viewer-immersive.css", import.meta.url), "utf8");
const mediaStyle = readFileSync(new URL("./media-style-consistency.css", import.meta.url), "utf8");
const quietStyle = readFileSync(new URL("./quiet-interface.css", import.meta.url), "utf8");
const homeCss = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const postCardStart = app.indexOf("function postCard(");
const postCardEnd = app.indexOf("function postPlaceValue(", postCardStart);
const postCardSource = app.slice(postCardStart, postCardEnd);

test("media viewer uses the Home creator row and keeps top Share removed", () => {
  const header = app.match(/<header class="post-viewer-topbar">([\s\S]*?)<\/header>/)?.[1] || "";
  assert.ok(header, "post viewer header should exist");
  assert.doesNotMatch(header, /post-viewer-share|aria-label="Share post"/);
  assert.match(header, /: mediaViewer\s*\?\s*""\s*:\s*`<button type="button" class="post-viewer-avatar"/,
    "media viewers omit the custom top identity row while other detail screens keep theirs");
  assert.match(header, /post-viewer-download/);
  assert.match(header, /post-viewer-avatar/);
  assert.match(header, /post-viewer-identity/);
  assert.match(header, /post-viewer-follow/);
  assert.match(app, /class="feed-author-avatar" data-avatar-profile=/);
  assert.match(app, /class="feed-author-name" data-profile=/);
  assert.match(app, /feedFollowButton\(\{author:u,me:api\.me\(\),following,requests:api\.db\(\)\.requests,className:"followpill"/);
  assert.doesNotMatch(postCardSource, /renderPostActionsMenu|postActionsMenu|data-post-actions-menu/,
    "Home and full-screen cards do not show the profile-only three-dot menu");
  assert.match(app, /<details class="profile-post-menu" data-profile-post-menu>/,
    "the existing three-dot menu remains on the profile page");
  assert.match(detailCss, /#app \.post-viewer-media \.post-viewer-media-info \.meta \.handle\s*\{\s*display:flex!important;/);
  assert.match(immersiveCss, /#app \.post-viewer-media \.post-viewer-download \{\s*margin-left:auto!important;/);
  assert.match(mediaStyle, /#app #feed \.clip:not\(\.post-detail\) \.handle,\s*#app \.post-viewer-media \.post-viewer-media-info \.meta \.handle/);
  assert.match(quietStyle, /#app \.home-screen \.handle \.feed-author-name,#app \.post-viewer-media \.post-viewer-media-info \.meta \.feed-author-name/);
  assert.match(homeCss, /#feed \.clip:not\(\.post-detail\) \.meta \{ bottom:calc\(104px \+ env\(safe-area-inset-bottom,0px\)\); \}/);
  assert.match(homeCss, /#feed \.clip:not\(\.post-detail\) \.soundbar \{ bottom:calc\(70px \+ env\(safe-area-inset-bottom,0px\)\); \}/);
  assert.match(homeCss, /#feed \.clip:not\(\.post-detail\) \.rail \{ bottom:calc\(76px \+ env\(safe-area-inset-bottom,0px\)\); \}/);
  assert.match(mediaStyle, /#app \.post-viewer-screen\.post-viewer-media \.post-viewer-media-info\s*\{\s*left:14px;\s*right:60px;\s*bottom:calc\(70px \+ env\(safe-area-inset-bottom,0px\)\)!important;\s*align-items:stretch;\s*gap:4px;/);
  assert.match(mediaStyle, /#app \.post-viewer-screen\.post-viewer-media \.clip\.post-detail > \.rail\s*\{\s*bottom:calc\(76px \+ env\(safe-area-inset-bottom,0px\)\);/);
  assert.match(mediaStyle, /#app \.post-viewer-screen\.post-viewer-media \.post-viewer-media-info \.meta \.caption-more\s*\{\s*color:rgba\(255,255,255,\.82\);/);
  assert.match(quietStyle, /#app \.post-viewer-media \.post-viewer-media-info \.meta \.followpill\{[^}]*min-height:48px[^}]*background:transparent;color:#fff/);
  assert.match(quietStyle, /#app \.post-viewer-media \.post-viewer-media-info \.meta \.followpill::before\{[^}]*border:1\.5px solid #fff/);
  assert.match(quietStyle, /#app \.post-viewer-media \.post-viewer-media-info \.meta \.followpill:is\(:hover,:active,\[aria-pressed=true\]\)\{background:transparent;color:#fff/);
  assert.doesNotMatch(detailCss, /font-size:12\.5px|font:600 11\.5px/,
    "viewer metadata uses the Home feed's caption and sound text sizes");
  assert.match(app, /class="act" data-share="\$\{p\.id\}"/,
    "the in-feed share action remains available");
});
