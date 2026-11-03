import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const code = readFileSync(new URL("./places-view.js", import.meta.url), "utf8").replace(/^import .*$/gm, "").replace(/^/, "const isDefaultAvatarMediaReference = () => false;\n");
const { renderPlacesLanding, mixLandingPlaces } = await import("data:text/javascript," + encodeURIComponent(code));
const it = (id, n = 3) => ({ place: { id, label: `Venue ${id}`, category: "Cafe" }, postCount: n, placeRating: { averageRating: 4.3, ratingCount: 7 } });
test("landing mixes buckets into one de-duplicated grid", { skip: !renderPlacesLanding }, () => {
  const landing = { loved: [it("a"), it("b")], trending: [it("a"), it("c")], suggested: [it("d")], nearby: [] };
  assert.deepEqual(mixLandingPlaces(landing).map(e => e.item.place.id), ["a", "d", "b", "c"]);
  const html = renderPlacesLanding({ landing, location: { status: "idle" } });
  assert.match(html, /places-landing-grid/);
  assert.match(html, /data-places-nearby/);
  assert.equal((html.match(/data-action="select-place"/g) || []).length, 4);
  assert.match(html, /4\.3 \(7\)/);
  assert.doesNotMatch(html, /places-landing-row/);
});
test("no location still renders grid", { skip: !renderPlacesLanding }, () => {
  const html = renderPlacesLanding({ landing: { loved: [it("x")] }, location: { status: "denied" } });
  assert.match(html, /Location is off/); assert.match(html, /Venue x/);
});
