// Isolated Wrangler only; this script deliberately cannot target a remote origin.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

const origin = "http://127.0.0.1:8686/api";
const accounts = [];
async function call(path, account, method = "GET", data) {
  const response = await fetch(origin + path, { method, headers: {
    ...(account ? { authorization: `Bearer ${account.accessToken}` } : {}),
    ...(data === undefined ? {} : { "content-type": "application/json" }),
  }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  return { status: response.status, data: await response.json() };
}
async function ok(...args) {
  const result = await call(...args);
  assert.ok(result.status >= 200 && result.status < 300, `${args[0]}: ${result.status} ${result.data.error || ""}`);
  return result.data;
}
function sql(command) {
  execFileSync("pnpm", ["--filter", "@workspace/api-server", "exec", "wrangler", "d1", "execute", "oldtime-app",
    "--local", "--persist-to", "/tmp/oldtime-release-check", "--config", "wrangler.toml", "--command", command],
  { cwd: new URL("../../../", import.meta.url), stdio: "pipe" });
}
for (const name of ["Places", "Visitor", "Private"]) {
  const username = `places_${name.toLowerCase()}_${randomUUID().slice(0,8)}`, password = `Local-${randomUUID()}!`;
  const auth = await ok("/auth/register", null, "POST", { username, password, email: `${username}@example.test`,
    displayName: `${name} Tester`, birthday: "2000-01-01", interests: ["music","fashion","tech"], followOldtime: false });
  accounts.push({ ...auth, username, password });
}
const [owner, visitor, privateUser] = accounts;
const id = `osm:node:900${Date.now()}${Math.floor(Math.random()*90+10)}`;
const place = { id, label: "Local Test Cafe", source: "osm", lat: 40.7, lon: -74,
  category: "cafe", address: "12 Test Street, New York" };
sql(`INSERT OR IGNORE INTO places(id,label,category,address,lat,lon,updated_at)
 VALUES('${id}','Local Test Cafe','cafe','12 Test Street, New York',40.7,-74,1);
 INSERT OR IGNORE INTO places(id,label,category,address,lat,lon,updated_at)
 VALUES('osm:relation:192307','Greece','country','Greece',39,22,1);`);
assert.equal((await ok("/places/profile?placeId=osm:relation:192307",owner)).place.label,"Greece");
assert.equal((await ok("/places/profile?placeId=osm:relation:192307",owner)).canRate,false);
const postIds = [];
for (const user of accounts) {
  const result = await ok("/posts", user, "POST", {
    text: `A real local fixture post by ${user.username}`, destination: "main", visibility: "public", place, mediaIds: [],
  });
  postIds.push(result.post.id);
}
sql(`UPDATE users SET is_private=1 WHERE id='${privateUser.account.id}';`);
const profilePath = `/places/profile?placeId=${encodeURIComponent(id)}`;
let profile = await ok(profilePath, owner);
assert.equal(profile.place.category, "cafe");
assert.equal(profile.place.address, place.address);
await ok("/places/saved",owner,"PUT",{place});
assert.equal((await ok(profilePath,owner)).saved,true);
assert.equal(profile.postCount, 2);
assert.equal(profile.peopleCount, 2);
assert.ok(!profile.people.some(p => p.id === privateUser.account.id));
assert.equal(profile.ratingCount, 0);
assert.equal((await call("/places/reviews", null, "PUT", {placeId:id,rating:5})).status, 401);
assert.equal((await call("/places/reviews", owner, "PUT", {placeId:id,rating:5,userId:visitor.account.id})).status, 400);
for (const patch of [{rating:0},{rating:6},{tip:"x".repeat(201)},{tags:["Fake"]},{placeId:"custom:cafe"},{placeId:"osm:node:999999999999999999"}]) {
  const result = await call("/places/reviews", owner, "PUT", {placeId:id,rating:5,...patch});
  assert.ok([400,404].includes(result.status));
}
const first = await ok("/places/reviews",owner,"PUT",{placeId:id,rating:5,tip:"Great coffee",tags:["Food","Cheap"]});
const [edited, retried] = await Promise.all([
  ok("/places/reviews",owner,"PUT",{placeId:id,rating:4,tip:"Lovely view",tags:["View"]}),
  ok("/places/reviews",owner,"PUT",{placeId:id,rating:4,tip:"Lovely view",tags:["View"]}),
]);
assert.equal(edited.id, first.id);
assert.equal(retried.id, first.id);
await ok("/places/reviews",visitor,"PUT",{placeId:id,rating:2,tip:"Busy at lunch",tags:["Busy"]});
profile = await ok(profilePath,owner);
assert.equal(profile.ratingCount,2);
assert.equal(profile.averageRating,3);
assert.equal(profile.ownReview.id,first.id);
assert.equal(profile.ownReview.tip,"Lovely view");
assert.equal(profile.reviews.length,2);
const report = await ok(`/places/reviews/${first.id}/report`,visitor,"POST",{reason:"Local report flow test"});
assert.equal(report.reported,true);
await ok(`/places/reviews/${first.id}/report`,visitor,"POST",{reason:"Edited report"});
const feed = await ok(`/places/feed?placeId=${encodeURIComponent(id)}&sort=top`,owner);
assert.equal(feed.posts.length,2);
assert.equal(feed.posts[0].placeRating.averageRating,3);
assert.equal(feed.posts[0].placeRating.ratingCount,2);
const custom = await ok("/places/profile?placeId=custom:cafe&label=Cafe",owner);
assert.equal(custom.canRate,false);
sql(`INSERT OR IGNORE INTO account_blocks(owner_id,blocked_id,created_at)
 VALUES('${owner.account.id}','${visitor.account.id}',1);`);
profile = await ok(profilePath,owner);
assert.equal(profile.postCount,1);
assert.equal(profile.peopleCount,1);
assert.equal(profile.ratingCount,1);
assert.equal(profile.averageRating,4);
assert.ok(!profile.reviews.some(r => r.userId === visitor.account.id));
// Unblock only the local fixture for the subsequent browser check.
sql(`DELETE FROM account_blocks WHERE owner_id='${owner.account.id}' AND blocked_id='${visitor.account.id}';`);
await writeFile("/tmp/oldtime-places-accounts.json",JSON.stringify(accounts),{mode:0o600});
await writeFile("/tmp/oldtime-places-fixture.json",JSON.stringify({place,postIds,reviewId:first.id}),{mode:0o600});
console.log("PASS local D1: metadata, public counts/people, private/blocked filtering, authenticated identity, bounds, atomic edit/retry, report persistence endpoint, rating hydration and custom-place rejection.");
