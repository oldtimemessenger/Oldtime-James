import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/post-detail.css", import.meta.url), "utf8");
test("typed Search opens media viewer without Explore swipe", () => {
  assert.match(app, /openPostViewer\(id, "", \{ source: "search" \}\)/);
  assert.match(app, /if \(viewerSource === "explore" && exploreIsCloud\(\)\) bindExploreViewerSwipe\(id\)/);
  assert.match(app, /isViewing:\(\)=>Boolean\(viewer\)&&\(viewerSource==="explore"\|\|viewerSource==="search"\)/);
});
test("comment sheet changes refresh the media overlay", () => {
  assert.ok((app.match(/notifyMediaViewerComments\(id\)/g) || []).length >= 4);
  assert.match(app, /removeEventListener\(MEDIA_VIEWER_COMMENTS_EVENT/);
});
test("caption, likes and sound credit stay visible; only author handle hidden", () => {
  assert.doesNotMatch(css, /post-viewer-media \.clip\.post-detail>\.meta \{ display:none/);
  assert.match(css, /post-viewer-media-info \.meta \.handle \{ display:none/);
  assert.match(css, /post-viewer-media-info \.soundbar \{[^}]*display:flex/);
});
test("scene fills space with contained foreground", () => {
  assert.match(css, /\.post-viewer-media \.post-viewer-feed \{[^}]*flex:1 1 auto/);
  assert.match(css, /object-fit:contain!important/);
});
test("typed query results open as search, unqueried Discover as explore", async () => {
  const eco = readFileSync(new URL("../app/explore-ecosystem.js", import.meta.url), "utf8");
  const src = eco.match(/export function exploreViewerSource[\s\S]*?\n}\n/)[0];
  const exploreViewerSource = new Function(`${src.replace("export ", "")}; return exploreViewerSource;`)();
  assert.equal(exploreViewerSource(""), "explore");
  assert.equal(exploreViewerSource("   "), "explore");
  assert.equal(exploreViewerSource("coffee"), "search");
  assert.equal(exploreViewerSource("#tag"), "search");
  assert.match(eco, /openPostViewer\(id, "", \{ source: exploreViewerSource\(query\) \}\)/);
  assert.doesNotMatch(eco, /const source = "explore";/);
  assert.equal((app.match(/bindExploreViewerSwipe\(id\)/g) || []).length, 1);
});
test("narrow comments sheet wraps actions without horizontal scroll", () => {
  assert.match(css, /\.comment-panel \.comment-footer, \.comment-panel \.comment-reply-content small \{[^}]*flex-wrap:wrap[^}]*min-width:0/);
  assert.match(css, /\.comment-panel \.comment-content,[^{]*\{ min-width:0/);
  assert.doesNotMatch(css, /\n\.comment-delete\s*\{/);
});
