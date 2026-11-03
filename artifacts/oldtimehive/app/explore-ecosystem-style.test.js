import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const search = readFileSync(new URL("./search-discovery.css", import.meta.url), "utf8");
const explore = readFileSync(new URL("./explore-ecosystem.css", import.meta.url), "utf8");
const exploreJs = readFileSync(new URL("./explore-ecosystem.js", import.meta.url), "utf8");
const appJs = readFileSync(new URL("./app.js", import.meta.url), "utf8");

test("Explore controls stay compact, reachable, and inside the mobile viewport", () => {
  assert.match(search, /\.search-screen \.page\s*\{\s*padding:\s*0 0 calc\(78px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(search, /\.discovery-back\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s);
  assert.match(search, /\.discovery-filter-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s);
  assert.match(search, /\.discovery-topic-scroll \.discovery-category\s*\{[^}]*min-height:\s*44px/);
  assert.match(search, /\.discovery-browse-menu\s*\{[^}]*position:\s*absolute/);
  assert.match(search, /\.discovery-search-wrap\s*\{[^}]*min-height:\s*44px/);
  assert.match(search, /\.discovery-category\s*\{[^}]*min-height:\s*38px/);
  assert.doesNotMatch(search, /\.discovery-search-wrap:focus-within\s*\{[^}]*213,\s*31,\s*50/s);
});

test("Cloud Explore uses the shared blue focus and compact touch targets", () => {
  assert.match(explore, /\.xe-search\s*\{[^}]*min-height:\s*44px/);
  assert.match(explore, /\.xe-search:focus-within\s*\{[^}]*20,\s*86,\s*217/s);
  assert.doesNotMatch(explore, /\.xe-search:focus-within\s*\{[^}]*213,\s*31,\s*50/s);
  assert.match(explore, /\.xe-tune\s*\{[^}]*min-height:\s*44px/);
  assert.match(explore, /\.xe-chip\s*\{[^}]*min-height:\s*38px/);
  assert.match(explore, /\.xe-more\s*\{[^}]*min-height:\s*44px/);
  assert.match(explore, /\.xe-sheet-close\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s);
  assert.match(explore, /\.xe-ghost, \.xe-save\s*\{[^}]*min-height:\s*44px/);
  assert.match(explore, /\.xe-empty\s*\{[^}]*padding:\s*28px 24px 32px/);
});

test("Search discovery cards follow Places styling with subtle visual variation", () => {
  assert.ok(search.includes(".search-screen .xe-grid {"));
  assert.ok(search.includes("gap: 10px 9px;"));
  assert.ok(search.includes("aspect-ratio: 4 / 5;"));
  assert.ok(search.includes("border-radius: 12px;"));
  assert.ok(search.includes("border: 1px solid var(--line, #e8e8eb);"));
  assert.ok(search.includes(".search-screen .xe-card:nth-child(5n + 2) .xe-tile { aspect-ratio: 1 / 1; }"));
  assert.ok(search.includes("@media (prefers-reduced-motion: reduce)"));
});

test("Search video cards reuse the Places post layout without restyling other tiles", () => {
  assert.match(search, /\.explore-video-card\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(search, /\.explore-video-card \.places-post-media\s*\{[^}]*aspect-ratio:\s*\.78;[^}]*border-radius:\s*9px/s);
  assert.match(search, /\.explore-video-card \.places-post-caption\s*\{[^}]*font-size:\s*11px;[^}]*font-weight:\s*600/s);
  assert.match(search, /\.explore-video-card \.places-post-author img\s*\{[^}]*width:\s*22px;[^}]*height:\s*22px/s);
  assert.match(search, /\.explore-feed-grid:has\(\.explore-video-card\)/);
});

test("Search's upper video rail follows the Places media and creator layout", () => {
  assert.match(exploreJs, /<article class="discovery-video-card places-post">/);
  assert.match(exploreJs, /class="places-post-media"/);
  assert.match(exploreJs, /class="places-post-caption"/);
  assert.match(exploreJs, /class="places-post-author" data-xe-profile=/);
  assert.match(search, /\.search-screen \.discovery-video-card \.places-post-media\s*\{[^}]*aspect-ratio:\s*\.78;[^}]*border-radius:\s*9px/s);
  assert.match(search, /\.search-screen \.discovery-video-track\s*\{[^}]*overflow-x:\s*auto/s);
});

test("Search filter menu supports Escape, arrow navigation, and focus restoration", () => {
  assert.match(appJs, /aria-controls="discover-browse-menu"/);
  assert.match(appJs, /event\.key === "Escape"/);
  assert.match(appJs, /event\.key === "ArrowDown" \|\| event\.key === "ArrowUp"/);
  assert.match(appJs, /closeDiscoverMenu\(\{ restoreFocus: true \}\)/);
});
