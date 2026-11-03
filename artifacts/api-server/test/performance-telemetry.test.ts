import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeClientPerformanceEvent } from "../src/cloudflare/performance-telemetry";

test("accepts only bounded feed timing fields and rounds them", () => {
  assert.deepEqual(normalizeClientPerformanceEvent({
    event: "feed",
    outcome: "success",
    metrics: { fetchMs: 123.6, renderMs: 45.4, rowsMs: 11.2 },
  }), {
    event: "feed",
    outcome: "success",
    metrics: { fetchMs: 120, renderMs: 50, rowsMs: 10 },
  });
});

test("rejects identifiers, content, cross-event metrics, and invalid timings", () => {
  for (const payload of [
    { event: "feed", outcome: "success", metrics: { fetchMs: 20, userId: "private" } },
    { event: "video", outcome: "frame", metrics: { urlMs: 20, postId: "private" } },
    { event: "feed", outcome: "success", metrics: { fetchMs: 20 }, accountId: "private" },
    { event: "feed", outcome: "success", metrics: { urlMs: 20 } },
    { event: "video", outcome: "frame", metrics: { urlMs: -1 } },
    { event: "video", outcome: "frame", metrics: { urlMs: 120001 } },
    { event: "video", outcome: "success", metrics: { urlMs: 20 } },
  ]) assert.equal(normalizeClientPerformanceEvent(payload), null);
});
