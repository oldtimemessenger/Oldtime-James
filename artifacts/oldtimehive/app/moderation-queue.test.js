import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reportRowInner, belongsInFilter, MODERATION_NOTE_MAX } from "./moderation-queue.js";
const src = readFileSync(new URL("./moderation-queue.js", import.meta.url), "utf8");

test("row escapes reporter text and shows only relevant actions/targets", () => {
  const html = reportRowInner({ report_key: "k1", kind: "post", category: "spam", reason: "<img src=x onerror=1>", status: "open", post_id: "p1", note: "a&b" });
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes('data-mq-post="p1"') && !html.includes("data-mq-place"));
  assert.ok(html.includes('data-mq-status="reviewed"') && html.includes('data-mq-status="dismissed"') && !html.includes('data-mq-status="open"'));
  assert.ok(html.includes(`maxlength="${MODERATION_NOTE_MAX}"`) && html.includes("a&amp;b"));
});
test("filter membership", () => {
  assert.ok(belongsInFilter("reviewed", "all"));
  assert.ok(!belongsInFilter("reviewed", "open"));
});
test("contract: endpoints, PUT body, no destructive calls, stale guards", () => {
  for (const s of ["/api/moderation/access", "/api/moderation/reports?status=", 'method: "PUT", body: { key, status, note }', "root.isConnected && alive()", "data-report-key", "reportKey"]) assert.ok(src.includes(s.replace("data-report-key", "dataset.reportKey")), s);
  assert.ok(!/method: "DELETE"|\/hide/.test(src));
});
