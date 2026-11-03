import test from "node:test";
import assert from "node:assert/strict";
import { hasPlaceMapCoordinates, initialPlaceMapView, normalizePlaceSearchResults, placesFeatureCollection } from "./places-map.js";

test("place maps only receive named places with valid saved coordinates", () => {
  const places = [
    { id: "osm:node:1", label: "Biscayne Bay", source: "osm", lat: 25.7617, lon: -80.1918 },
    { id: "custom:typed", label: "A typed-only location", source: "custom" },
    { id: "osm:node:2", label: "Invalid latitude", source: "osm", lat: 91, lon: 0 },
    { id: "osm:node:3", label: "Invalid longitude", source: "osm", lat: 0, lon: 181 },
    { id: "osm:node:4", label: "Biscayne Bay duplicate", source: "osm", lat: 25.76, lon: -80.19 },
    { id: "osm:node:1", label: "Duplicate identity", source: "osm", lat: 25.7617, lon: -80.1918 },
  ];
  const collection = placesFeatureCollection(places);
  assert.equal(collection.features.length, 2);
  assert.deepEqual(collection.features[0].geometry.coordinates, [-80.1918, 25.7617]);
  assert.equal(hasPlaceMapCoordinates(places[0]), true);
  assert.equal(hasPlaceMapCoordinates(places[1]), false);
  assert.equal(hasPlaceMapCoordinates({ lat: null, lon: null }), false);
  assert.equal(hasPlaceMapCoordinates({ lat: 0, lon: 0 }), true);
  assert.equal(hasPlaceMapCoordinates({ lat: "25.7617", lon: "-80.1918" }), true);
});

test("place search suggestions keep usable names and pins for the saved post tag", () => {
  const results = normalizePlaceSearchResults([
    { id: "osm:relation:miami", label: "Miami", source: "osm", lat: 25.7617, lon: -80.1918 },
    { id: "osm:relation:beach", label: "Miami Beach", source: "osm", lat: 25.7907, lon: -80.13 },
    { id: "osm:node:no-pin", label: "No pin", source: "osm" },
    { id: "osm:node:blank", label: " ", source: "osm", lat: 25.76, lon: -80.19 },
  ]);
  assert.deepEqual(results.map(place => place.label), ["Miami", "Miami Beach"]);
  assert.deepEqual(results[1], {
    id: "osm:relation:beach",
    label: "Miami Beach",
    source: "osm",
    lat: 25.7907,
    lon: -80.13,
  });
});

test("the selected place is marked on the map without changing its saved coordinates", () => {
  const selected = { id: "osm:way:900", label: "Biscayne Bay", source: "osm", lat: 25.76, lon: -80.19 };
  const collection = placesFeatureCollection([selected], selected.id);
  assert.equal(collection.features[0].properties.selected, true);
  assert.deepEqual(collection.features[0].geometry.coordinates, [-80.19, 25.76]);
});

test("a tagged place map centers and zooms to its selected pin, not the worldwide feed extent", () => {
  const miami = { id: "osm:relation:miami", label: "Miami", source: "osm", lat: "25.7617", lon: "-80.1918" };
  const london = { id: "osm:relation:london", label: "London", source: "osm", lat: 51.5072, lon: -0.1276 };
  assert.deepEqual(initialPlaceMapView([miami, london], miami.id), {
    center: [-80.1918, 25.7617],
    zoom: 15,
    selected: true,
  });
});
