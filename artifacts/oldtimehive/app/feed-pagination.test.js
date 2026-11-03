import assert from "node:assert/strict";
import test from "node:test";
import { feedPaginationRootMargin } from "./feed-pagination.js";

test("feed pagination prefetch distance scales with the mobile viewport", () => {
  assert.equal(feedPaginationRootMargin({ viewportHeight: 800, connection: null }), "0px 0px 920px 0px");
  assert.equal(feedPaginationRootMargin({ viewportHeight: 400, connection: null }), "0px 0px 460px 0px");
});

test("feed pagination starts earlier on slow connections", () => {
  assert.equal(feedPaginationRootMargin({ viewportHeight: 600, connection: { effectiveType: "2g" } }), "0px 0px 960px 0px");
  assert.equal(feedPaginationRootMargin({ viewportHeight: 600, connection: { effectiveType: "slow-2g" } }), "0px 0px 960px 0px");
});

test("feed pagination honors Data Saver and clamps extreme viewport sizes", () => {
  assert.equal(feedPaginationRootMargin({ viewportHeight: 800, connection: { saveData: true } }), "0px 0px 520px 0px");
  assert.equal(feedPaginationRootMargin({ viewportHeight: 5000, connection: null }), "0px 0px 1000px 0px");
  assert.equal(feedPaginationRootMargin({ viewportHeight: 0, connection: null }), "0px 0px 736px 0px");
});
