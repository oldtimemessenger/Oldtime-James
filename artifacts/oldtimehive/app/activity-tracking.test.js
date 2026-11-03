import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("analytics waits for visible public content and avoids unchanged progress writes", async () => {
  const source = await readFile(new URL("./activity-tracking.js", import.meta.url), "utf8");
  assert.match(source, /SAMPLE_INTERVAL_MS=500,PROGRESS_INTERVAL_MS=15000/);
  assert.match(source, /if\(!item\|\|!element\|\|!viewer\|\|item\.author===viewer\|\|!isPublicAnalyticsItem\(item\)\)return/);
  assert.match(source, /if\(shown&&ready&&!video&&item\.kind!=="video"\)ensureSession\(\)/);
  assert.match(source, /watchedMs\+=Math\.min\(delta,advance\);\s*ensureSession\(\);/);
  assert.match(source, /if\(!ended&&snapshot\.visibleMs<=savedVisibleMs&&snapshot\.watchedMs<=savedWatchedMs\)return/);
  assert.match(source, /if\(now-lastSent>=PROGRESS_INTERVAL_MS\)\{lastSent=now;submit\(false\);\}/);
  assert.match(source, /if\(document\.hidden\)submit\(false\)/);
  assert.match(source, /if\(document\.hidden\)\{lastVideo=video\?\.currentTime\|\|0;return;\}/);
  assert.doesNotMatch(source, /if\(owner&&account&&owner!==account\)void requestCloudApi\("\/api\/analytics\/sessions"/);
});
