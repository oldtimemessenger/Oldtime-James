import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const discovery = readFileSync(new URL("./discovery-professional.css", import.meta.url), "utf8");

test("the primary navigation keeps Search visible in its fifth slot", () => {
  assert.match(app, /data-tab="search"[^>]*aria-label="Search"[^>]*data-testid="button-nav-search"/);
  assert.match(styles, /#app \.nav:not\(\.nav-hidden\)\s*\{\s*grid-template-columns:repeat\(5,minmax\(0,1fr\)\);/);
  assert.match(styles, /button\[data-tab="search"\]\s*\{\s*display:flex;\s*visibility:visible;\s*opacity:1;/);
});

test("Home keeps native vertical scrolling, momentum, and snap", () => {
  assert.match(styles, /\.feed\s*\{[^}]*overflow-y:\s*auto;[^}]*scroll-snap-type:\s*y mandatory;[^}]*-webkit-overflow-scrolling:\s*touch;/);
  assert.match(app, /new IntersectionObserver\([\s\S]*?\{ root: \$\("#feed"\), rootMargin: "320px 0px" \}/);
});

test("full-screen media uses native vertical snap instead of scripted touch swipes", () => {
  assert.match(discovery, /\.post-viewer-explore \.post-viewer-feed[^}]*overflow-y:auto[^}]*scroll-snap-type:y mandatory[^}]*touch-action:pan-y/);
  const start = app.indexOf("function bindExploreViewerSwipe");
  const end = app.indexOf("// Search/Discover media viewer", start);
  const binder = app.slice(start, end);
  assert.match(binder, /feed\.addEventListener\("scroll", onScroll/);
  assert.doesNotMatch(binder, /feed\.addEventListener\("touch(?:start|end|cancel)"/);
  assert.doesNotMatch(binder, /feed\.addEventListener\("wheel"/);
});

test("Search viewer pages through matching media and Discover loads more posts", () => {
  assert.match(app, /viewerAdjacentPostIds\(id, viewerSource\)/);
  assert.match(app, /const ids = api\.posts\(\)\.filter\(post =>/);
  assert.match(app, /exploreEco\.ensureNext\(id\)/);
  assert.match(app, /data-viewer-next-pending/);
});
