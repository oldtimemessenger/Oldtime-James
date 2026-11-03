import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { capturePreservedScroll, restorePreservedScroll } from "./scroll-preservation.js";

function rootWith(elements) {
  return {
    tagName: "ROOT",
    querySelectorAll: selector => selector === "*" ? elements : [],
  };
}

test("captures and restores mobile feed scroll offsets by stable key", () => {
  const original = [
    { dataset: { scrollPreserve: "home-feed" }, scrollTop: 1432, scrollLeft: 0 },
    { dataset: { scrollPreserve: "community-feed" }, scrollTop: 578, scrollLeft: 24 },
  ];
  const snapshot = capturePreservedScroll(rootWith(original));
  const rerendered = [
    { dataset: { scrollPreserve: "home-feed" }, scrollTop: 0, scrollLeft: 0 },
    { dataset: { scrollPreserve: "community-feed" }, scrollTop: 0, scrollLeft: 0 },
  ];

  restorePreservedScroll(rootWith(rerendered), snapshot);

  assert.deepEqual(rerendered.map(({ scrollTop, scrollLeft }) => [scrollTop, scrollLeft]), [
    [1432, 0],
    [578, 24],
  ]);
});

test("only the same feed view restores its marked scroller", async () => {
  const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
  assert.match(source, /previousScrollContext === nextScrollContext/);
  assert.match(source, /function screenScrollContext\(inner\)/);
  assert.match(source, /const screenScrollCache = new Map\(\)/);
  assert.match(source, /cacheScreenScroll\(previousScrollContext, currentScrollSnapshot\)/);
  assert.match(source, /dataset\.scrollRestored = String\(scrollSnapshot\.length > 0\)/);
  assert.match(source, /data-scroll-context="home:\$\{homeView\}:\$\{homeTopic\}"/);
  assert.match(source, /data-scroll-context="community:\$\{communityView\}"/);
  assert.match(source, /data-scroll-preserve="home-feed"/);
  assert.match(source, /data-scroll-preserve="community-feed"/);
  assert.match(source, /scroll:\s*capturePreservedScroll\(screen\)/);
  assert.match(source, /pendingNavigationScrollRestore/);
  assert.match(source, /data-(?:ap-view|ct-view|chat-view|places-view)/);
  assert.match(await readFile(new URL("./chat.js", import.meta.url), "utf8"), /data-chat-view="thread"/);
});

test("restores scrolled containers on screens that do not have explicit markers", () => {
  const makeScroller = (scrollTop, scrollLeft = 0) => ({
    tagName: "DIV",
    classList: ["scroll", "profile-page"],
    dataset: {},
    scrollTop,
    scrollLeft,
  });
  const original = [makeScroller(0), makeScroller(684, 21)];
  const snapshot = capturePreservedScroll(rootWith(original));
  const rerendered = [makeScroller(0), makeScroller(0)];

  restorePreservedScroll(rootWith(rerendered), snapshot);

  assert.deepEqual(rerendered.map(({ scrollTop, scrollLeft }) => [scrollTop, scrollLeft]), [
    [0, 0],
    [684, 21],
  ]);
});
