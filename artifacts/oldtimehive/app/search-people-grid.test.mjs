import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ecosystem = readFileSync(new URL("./explore-ecosystem.js", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("./search-discovery.css", import.meta.url), "utf8");

test("Search People results reuse aligned profile and follow cards", () => {
  assert.match(ecosystem, /renderSuggestedPerson\(\{\s*\.\.\.person,\s*profile,\s*\}\)/);
  assert.match(app, /renderSuggestedPerson:\s*discoveryPersonMarkup/);
  assert.match(ecosystem, /xe-people-list xe-people-card-grid/);
  assert.match(app, /data-discovery-profile="\$\{esc\(id\)\}"/);
  assert.match(app, /data-discovery-follow="\$\{esc\(id\)\}"/);
  assert.match(ecosystem, /\.map\(person => personRow\(person, !showAll\)\)/);
  assert.match(ecosystem, /const peopleClass = showAll \? "xe-people-list xe-search-name-list" : "xe-people-list xe-people-card-grid"/);
  assert.match(ecosystem, /xe-people-list xe-people-card-grid" aria-label="People"/);
});

test("Search People cards form a compact two-column vertical grid", () => {
  assert.match(styles, /\.xe-people-list\.xe-people-card-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*grid-auto-flow:\s*row[^}]*overflow-x:\s*hidden/s);
  assert.match(styles, /\.xe-people-card-grid > \.discovery-person\s*\{[^}]*height:\s*240px/s);
  assert.match(styles, /\.xe-people-card-grid \.discovery-person-actions\s*\{[^}]*margin-top:\s*auto/s);
});
