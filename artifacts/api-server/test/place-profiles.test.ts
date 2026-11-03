import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewInput } from "../src/cloudflare/place-profiles";
import { photonMetadata } from "../src/cloudflare/place-metadata";
import { placeTagSchema } from "../src/lib/place-tag";

test("Photon category and address survive tag validation", () => {
  const metadata = photonMetadata({osm_value:"nature_reserve",housenumber:"12",street:"Oak St",city:"Miami",country:"US"});
  assert.equal(metadata.category,"nature reserve");
  assert.equal(metadata.address,"12 Oak St, Miami, US");
  const tag = {id:"osm:way:123",label:"Reserve",source:"osm",lat:25,lon:-80,...metadata};
  assert.deepEqual(placeTagSchema.parse(tag),tag);
});

test("reviews accept only the authenticated person's fields, real-place IDs and bounded values", () => {
  const good = {placeId:"osm:node:123",rating:4,tip:" Nice view ",tags:["View","Hidden gem"]};
  assert.equal(reviewInput.parse(good).tip,"Nice view");
  for (const patch of [{rating:0},{rating:6},{rating:1.5},{rating:"5"},{tip:"x".repeat(201)},
    {placeId:"custom:park"},{userId:"someone-else"},{tags:["Invented"]}]) {
    assert.equal(reviewInput.safeParse({...good,...patch}).success,false,JSON.stringify(patch));
  }
});
