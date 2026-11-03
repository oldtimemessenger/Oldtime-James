import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./media-style-consistency.css", import.meta.url), "utf8");
const finalCss = readFileSync(new URL("./unboxed-interface.css", import.meta.url), "utf8");

test("media feeds share the reference icon and text scale", () => {
  assert.match(css, /\.clip:not\(\.post-detail\).*?gap:24px;/s);
  assert.match(css, /\.clip:not\(\.post-detail\).*?width:30px;\s*height:30px;/s);
  assert.match(css, /\.clip:not\(\.post-detail\).*?min-width:44px;\s*min-height:44px;/s);
  assert.match(css, /\.post-viewer-screen\.post-viewer-media.*?width:30px;\s*height:30px;/s);
  assert.match(css, /\.followpill\s*\{\s*font-size:12px;/s);
  assert.match(css, /font-size:14px;\s*font-weight:400;\s*line-height:19px;/);
  assert.match(css, /\.post-viewer-screen\.post-viewer-media.*?line-height:19px;/s);
  assert.match(css, /\.community-video-card.*?width:24px;\s*height:24px;/s);
});

test("Community text-only cards are excluded from media styling", () => {
  assert.match(css, /\.community-post-card:has\(\.community-post-media\)/);
  assert.match(css, /\.community-post-card:has\(\.community-attachment-grid\)/);
  assert.doesNotMatch(css, /#app \.community-post-card \.community-post-actions/);
});

test("saved media bookmarks are solid white on non-Community media rails", () => {
  assert.match(finalCss, /#app \.clip \.act\[data-save\]\.on \.navic[\s\S]*?fill:#fff!important/);
  assert.match(finalCss, /\.blast-screen \.blast-post-actions \[data-blast-save\]\.is-on svg[\s\S]*?fill:#fff!important/);
});
