import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./community-screen.css", import.meta.url), "utf8");

test("Search is a bottom-nav destination and Community has no header Search", () => {
  assert.doesNotMatch(app, /id="community-search-open"/);
  assert.match(app, /data-tab="search"[^>]*aria-label="Search" data-testid="button-nav-search"/);
  assert.doesNotMatch(app, /communitiesScreen \? `<button type="button" data-tab="search"/);
  assert.match(app, /function navigateMainSection\(section\)/);
  assert.match(app, /if \(!\["updates", "communities", "search", "chat", "profile"\]\.includes\(section\)\)/);
  assert.match(app, /requestAnimationFrame\(\(\) => \$\("#q"\)\?\.focus/);
  assert.match(css, /\.community-nav\.nav\s*\{[^}]*grid-template-columns:\s*repeat\(5/);
});
