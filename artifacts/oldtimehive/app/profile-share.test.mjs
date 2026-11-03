import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseOldtimeProfileCode, openProfileShare } from "./profile-share.js";

const src = await readFile(new URL("./profile-share.js", import.meta.url), "utf8");
const css = await readFile(new URL("./profile-share.css", import.meta.url), "utf8");

test("accepts canonical Oldtime profile URLs", () => {
  assert.deepEqual(parseOldtimeProfileCode("https://www.heyoldtime.com/?user=maya_r"), { ok: true, username: "maya_r" });
  assert.deepEqual(parseOldtimeProfileCode("https://heyoldtime.com/?user=j.lee"), { ok: true, username: "j.lee" });
  assert.deepEqual(parseOldtimeProfileCode("  https://heyoldtime.com/?user=ab  "), { ok: true, username: "ab" });
});

test("rejects unrelated, deceptive or unsafe payloads", () => {
  const bad = [
    "", null, 42, "maya", "http://heyoldtime.com/?user=maya",
    "javascript:alert(1)", "data:text/html,hi",
    "https://heyoldtime.com.evil.io/?user=maya", "https://evilheyoldtime.com/?user=maya",
    "https://heyoldtime.co/?user=maya", "https://m.heyoldtime.com/?user=maya",
    "https://maya:pw@heyoldtime.com/?user=maya", "https://heyoldtime.com@evil.io/?user=maya",
    "https://heyoldtime.com:8443/?user=maya", "https://heyoldtime.com/admin?user=maya",
    "https://heyoldtime.com/?user=maya&token=abc", "https://heyoldtime.com/?user=maya#x",
    "https://heyoldtime.com/?user=", "https://heyoldtime.com/?user=<script>",
    "https://heyoldtime.com/?user=a&user=b", "https://xn--heyoldtme-x9a.com/?user=maya",
    "https://heyoldtime.com/\\?user=maya", "WIFI:S:home;P:secret;;",
    "https://heyoldtime.com/?user=" + "a".repeat(40)
  ];
  for (const v of bad) assert.equal(parseOldtimeProfileCode(v).ok, false, String(v));
});

test("exports openProfileShare as a function", () => {
  assert.equal(typeof openProfileShare, "function");
});

test("source safety: no logging, storage, navigation or auto camera", () => {
  assert.doesNotMatch(src, /console\.(log|info|debug|warn|error)/);
  assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(src, /location\.(href|assign|replace)\s*=|location\.assign|window\.open/);
  assert.doesNotMatch(src, /toDataURL|toBlob|fetch\(/);
  assert.match(src, /facingMode:\s*"environment"/);
  assert.match(src, /getTracks\(\)/);
  assert.match(src, /\.stop\(\)/);
  assert.match(src, /token !== camToken/);
  assert.match(src, /jsQR\(/);
  // getUserMedia only reachable from the explicit startCamera action
  const gum = src.indexOf("getUserMedia({");
  assert.ok(gum > src.indexOf("async function startCamera"));
  assert.doesNotMatch(src.slice(src.indexOf("setMode(\"code\");\n  requestAnimationFrame")), /startCamera\(\)|shareExternally\(/);
  assert.doesNotMatch(src, /\p{Extended_Pictographic}/u);
});

test("css respects reduced motion, safe area and small screens", () => {
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /max-width:360px/);
});
