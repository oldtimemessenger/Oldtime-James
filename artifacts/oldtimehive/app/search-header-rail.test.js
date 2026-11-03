import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./search-discovery.css", import.meta.url), "utf8");
const xe = readFileSync(new URL("./explore-ecosystem.js", import.meta.url), "utf8");
const search = app.slice(app.indexOf("function search()"), app.indexOf("\nfunction notes()", app.indexOf("function search()")));

test("Search uses the Community header, inline input and accessible icon-only compose", () => {
  const head = search.slice(search.indexOf('<header class="community-header search-app-header">'), search.indexOf("</header>", search.indexOf("search-app-header")));
  assert.match(head, /<h1>Search<\/h1>/);
  assert.match(head, /class="community-search-button discovery-search-toggle[\s\S]*?id="discovery-search-toggle"/);
  assert.match(head, /class="community-new-post compose-trigger" id="search-new-post" aria-label="New post">\$\{ic\.plus\}/);
  assert.match(search, /#search-new-post"\)\?\.addEventListener\("click", openHomeCreate\)/);
  assert.match(search, /searchSection === "search"\) requestAnimationFrame\(\(\) => \$\("#q"\)\?\.focus/);
  assert.doesNotMatch(search, /class="discovery-header"/);
  assert.match(css, /\.search-app-header \.community-search-button \{[^}]*border:0;[^}]*background:transparent/);
  assert.match(app, /import "\.\/release-interface\.css"/);
});

test("Category row is one unboxed underlined scroller with the filter icon on the right", () => {
  const row = search.slice(search.indexOf('class="discovery-home-topic-tabs"'), search.indexOf('class="discovery-browse-menu"'));
  assert.ok(row.indexOf('class="discovery-topic-scroll"') < row.indexOf('class="discovery-filter-button"'));
  assert.match(css, /\.search-screen \.discovery-topic-scroll \.discovery-category \{[^}]*border:0;[^}]*background:none/);
  assert.match(css, /\.discovery-category\.on::after \{[^}]*background:#1456d9/);
});

test("Search removes Stories but keeps the horizontal video rail and discovery hub", () => {
  assert.doesNotMatch(app, /discoveryStoryRail|bindDiscoveryStoryPreviews|data-discovery-story-preview/);
  assert.doesNotMatch(css, /discovery-stories|discovery-story-card/);
  assert.match(search, /const videoPreviewRail = exploreIsCloud\(\)[\s\S]*videoPreviewRailMarkup\(\)/);
  assert.ok(search.indexOf("${homeTopicTabs}") < search.indexOf("${videoPreviewRail}"));
  assert.ok(search.indexOf("${videoPreviewRail}") < search.indexOf('<div class="discovery-body">'));
  assert.match(css, /\.discovery-video-rail \{/);
  assert.match(css, /\.discovery-video-track \{[^}]*overflow-x:auto/);
  assert.match(xe, /let type = "all"/);
  assert.match(xe, /\["engagement", "Most interacted"\]/);
  assert.match(xe, /\["shuffle", "Shuffle"\]/);
  assert.match(search, /role="menuitemradio" aria-checked="\$\{exploreEco\.currentSort\(\) === value\}" data-xe-sort="\$\{value\}"/);
  assert.match(xe, /setSort\(button\.dataset\.xeSort\)/);
  assert.doesNotMatch(xe, /class="xe-chips xe-sort"/);
  assert.match(xe, /sort === "shuffle" && shuffleSeed/);
});

test("Discover is exactly two columns everywhere; no stale three-column rule", () => {
  assert.doesNotMatch(css, /(explore-feed-grid|xe-grid)[^{}]*\{[^}]*repeat\(3/);
  assert.match(css, /\.search-screen \.xe-grid, \.search-screen \.explore-feed-grid \{ ?grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/);
});

test("cloud Community uses the real feed module without an internal release notice", () => {
  assert.match(app, /legacyFeedFallback \? communityFallbackTabs :/);
  const tabs = app.slice(app.indexOf("const communityFallbackTabs"), app.indexOf("shell(`", app.indexOf("const communityFallbackTabs")));
  assert.match(tabs, /<nav class="cf-feed-tabs"/);
  assert.match(tabs, />Following<\/button>[\s\S]*>Discover<\/button>[\s\S]*\["popular", "Popular"\], \["friends", "Mutuals \/ Friends"\]/);
  assert.doesNotMatch(tabs, /Photos & Video|Unavailable<\/small>/);
  assert.match(tabs, /class="cf-controls" data-community-fallback-controls/);
  assert.match(tabs, /class="cf-description"/);
  assert.doesNotMatch(app, /This server doesn’t support Popular/);
  assert.doesNotMatch(app, /Updated feed controls are awaiting the server release|data-community-server-update/);
});

test("Magnifier opens a real focused input; compact field with no oversized focus ring", () => {
  assert.match(search, /const closing = \["search","people","places"\]\.includes\(searchSection\);[\s\S]*searchSection = closing \? "trending" : "search";/);
  assert.match(search, /class="search-header-field">\$\{input\.replace/);
  assert.match(search, /if \(searchInput\) searchInput\.oninput =/);
  assert.match(search, /exploreEco\.bind\(app, \{ bindQuery:/);
  assert.match(css, /\.search-screen \.xe-search,\s*\.search-screen \.discovery-search-wrap \{[^}]*min-height:38px;[^}]*border:0;[^}]*box-shadow:none/);
  assert.match(css, /\.search-screen \.xe-search:focus-within,\s*\.search-screen \.discovery-search-wrap:focus-within \{[^}]*border:0; box-shadow:none; outline:0/);
});

test("Result-type filters are flat light-grey rounded rectangles; active pale blue, no outline", () => {
  const rule = css.match(/\.xe-chips\[aria-label="Result type"\] \.xe-chip \{([^}]*)\}/)[1];
  assert.match(rule, /min-height:34px/); assert.match(rule, /border:0/); assert.match(rule, /border-radius:8px/); assert.match(rule, /background:#f2f3f5/);
  assert.match(css, /\.xe-chips\[aria-label="Result type"\] \.xe-chip\.on \{[^}]*border:0; background:#e8f0fe; color:#1456d9/);
  assert.match(css, /\.search-screen \.discovery-topic-scroll \.discovery-category \{[^}]*border:0;[^}]*background:none/);
});
