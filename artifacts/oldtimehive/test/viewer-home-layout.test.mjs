import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/styles.css", import.meta.url), "utf8");
const viewer = readFileSync(new URL("../app/post-viewer-immersive.css", import.meta.url), "utf8");
const community = readFileSync(new URL("../app/community-feeds.css", import.meta.url), "utf8");

test("Home uses media styling only when there are actual post clips", () => {
  assert.match(app, /const mediaFeedScreen = \(homeScreen && \/\\bclass=/);
  assert.match(app, /const light = mode === "light" \|\| \(homeScreen && !mediaFeedScreen\)/);
  assert.match(app, /classList\.toggle\("media-feed-phone", mediaFeedScreen\)/);
  assert.match(app, /classList\.toggle\("lightnav", light\)/);
});

test("empty Home keeps its explanation below the header rather than behind it", () => {
  assert.match(styles, /\.home-screen:not\(\[data-places-view="true"\]\):not\(:has\(\.clip\)\) \.home-discovery-header\s*\{[^}]*position:relative;[^}]*order:-1/s);
  assert.match(styles, /\.home-screen:not\(\[data-places-view="true"\]\):not\(:has\(\.clip\)\) #feed\s*\{[^}]*position:relative;[^}]*padding:12px/s);
  assert.match(app, /Your Following feed starts here/);
  assert.match(app, /Public posts from other accounts are in Discovery/);
});

test("media geometry beats the inset scene with full-bleed photos and bottom-aligned controls", () => {
  assert.match(viewer, /#app \.post-viewer-screen\.post-viewer-media \.post-viewer-feed\s*\{[^}]*position:absolute; inset:0;[^}]*margin:0!important/s);
  assert.match(viewer, /\.clip\.post-detail > \.fullimg,[^{]+\{[^}]*object-fit:cover!important/s);
  assert.match(viewer, /\.post-viewer-footer\.post-viewer-composer\s*\{[^}]*position:absolute; inset:auto 0 0/s);
  assert.match(viewer, /\.post-viewer-media-info\s*\{[^}]*bottom:calc\(58px \+ env\(safe-area-inset-bottom,0px\)\)!important/s);
  assert.match(viewer, /\.rail\s*\{[^}]*bottom:calc\(58px \+ env\(safe-area-inset-bottom,0px\)\)/s);
});

test("Home profile shortcut inherits its readable header color and stays clickable", () => {
  assert.match(styles, /\.home-primary-row>\.app-profile-shortcut\s*\{[^}]*color:inherit/s);
  assert.match(styles, /\.app-profile-shortcut\s*\{[^}]*position:relative;z-index:2/s);
  assert.match(app, /profileShortcut\.onclick = \(\) => navigateMainSection\("profile"\)/);
  assert.match(app, /if \(section === "profile"\) \{ profileId = api\.me\(\)\.id/);
});

test("suggested people have consistent name, reason and action rows", () => {
  assert.match(community, /\.cf-people-rail article \{ display:flex; flex-direction:column; \}/);
  assert.match(community, /\.cf-person b \{ line-height:16px; min-height:16px; \}/);
  assert.match(community, /\.cf-people-rail article > p\s*\{[^}]*flex:0 0 28px/s);
  assert.match(community, /\.cf-people-rail \.cf-person-actions \{ margin-top:auto; \}/);
});

test("new and no-follow accounts start on For You without changing Following membership", () => {
  const body = app.match(/function defaultHomeView\(me\) \{([^}]+)\}/)?.[1];
  assert.ok(body, "Account-entry feed decision is testable");
  const landing = new Function("me", body);
  assert.equal(landing(null), "explore");
  assert.equal(landing({following: []}), "explore");
  assert.equal(landing({following: ["followed-member"]}), "following");
  assert.match(app, /homeView = defaultHomeView\(api\.me\(\)\)/);
  assert.match(app, /if \(homeView === "following"\) posts = followingPosts\(posts, me\)/);
});

test("shared Home media and people-match cards keep compact aligned controls", () => {
  assert.match(styles, /#feed \.clip:not\(\.post-detail\):not\(:has\(> \.soundbar\)\) \.meta \{ bottom:calc\(76px/);
  assert.match(styles, /\.people-match-card \{ display:flex; flex-direction:column;/);
  assert.match(styles, /\.people-match-actions \{[^}]*margin-top:auto/s);
});
