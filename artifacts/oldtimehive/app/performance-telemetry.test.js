import assert from "node:assert/strict";
import test from "node:test";
import {
  createOptInPerformanceCapture,
  readFeedServerTimings,
  sanitizeClientPerformanceEvent,
} from "./performance-telemetry.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test("reads only approved same-origin server timing values for the requested feed", () => {
  const metrics = readFeedServerTimings([
    {
      name: "https://www.heyoldtime.com/api/feed?surface=main",
      startTime: 20,
      serverTiming: [
        { name: "feed_rows", duration: 11.4 },
        { name: "feed_hydrate", duration: 22.2 },
        { name: "feed_rank", duration: 3 },
        { name: "worker", duration: 44.9 },
        { name: "private", duration: 500 },
      ],
    },
    {
      name: "https://third-party.invalid/api/feed",
      startTime: 21,
      serverTiming: [{ name: "feed_rows", duration: 999 }],
    },
  ], 15, "https://www.heyoldtime.com");
  assert.deepEqual(metrics, { rowsMs: 10, hydrateMs: 20, rankMs: 0, workerMs: 40 });
});

test("telemetry payloads contain only bounded metric fields and fixed enums", () => {
  assert.deepEqual(sanitizeClientPerformanceEvent("video", {
    urlMs: 123,
    activeToFrameMs: 456,
    postId: "must-not-leave-the-browser",
  }, "frame", "video-frame"), {
    event: "video",
    outcome: "frame",
    metrics: { urlMs: 120, activeToFrameMs: 460 },
    frameSignal: "video-frame",
  });
  assert.equal(sanitizeClientPerformanceEvent("feed", { fetchMs: -1 }, "success"), null);
  assert.equal(sanitizeClientPerformanceEvent("feed", { fetchMs: 10 }, "frame"), null);
});

test("opt-in capture is limited to twelve events and expires after ten minutes", () => {
  const storage = createMemoryStorage();
  let now = 1_000;
  const capture = createOptInPerformanceCapture({
    search: "?perf_capture=1",
    storage,
    now: () => now,
  });

  assert.equal(capture.activatedFromQuery, true);
  assert.equal(capture.isOptInSession(), true);
  assert.equal(capture.isActive(), true);
  for (let event = 0; event < 12; event += 1) assert.equal(capture.consume(), true);
  assert.equal(capture.isActive(), false);
  assert.equal(storage.getItem("oldtime.performanceCapture.v1"), null);

  const expiringCapture = createOptInPerformanceCapture({
    search: "?perf_capture=1",
    storage,
    now: () => now,
  });
  now += 10 * 60 * 1000;
  assert.equal(expiringCapture.isActive(), false);
});

test("capture stays disabled without the explicit URL opt-in", () => {
  const capture = createOptInPerformanceCapture({
    search: "?tab=community",
    storage: createMemoryStorage(),
    now: () => 1_000,
  });
  assert.equal(capture.activatedFromQuery, false);
  assert.equal(capture.isOptInSession(), false);
  assert.equal(capture.isActive(), false);
});
