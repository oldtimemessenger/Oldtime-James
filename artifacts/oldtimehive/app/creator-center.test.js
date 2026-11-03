import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./creator-center.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./creator-center.css", import.meta.url), "utf8");

test("Creator Center has compact Overview, Content, Analytics and Tools sections", () => {
  assert.match(source, /const MAIN_SECTIONS = \["creator-center", "creator-content", "creator-analytics", "creator-tools"\]/);
  assert.match(source, /<h1>Creator Center<\/h1>/);
  assert.match(source, /aria-current="page"/);
  assert.match(source, /"\s*light"\);/);
});

test("a non-Creator account gets a useful route to account-type settings instead of a retry loop", () => {
  assert.match(source, /if \(forbidden && \["creator-center", "creator-content", "creator-analytics", "creator-tools"\]\.includes\(view\)\)/);
  assert.match(source, /Creator tools are not enabled for this account/);
  assert.match(source, /data-ct-account-type/);
  assert.match(source, /navigate\("account-type"\)/);
  const accessBranch = source.split('if (forbidden && ["creator-center"')[1]?.split("const heading =")[0] || "";
  assert.doesNotMatch(accessBranch, /data-ct-retry/);
});

test("content and analytics use measured owner data with pagination and honest empty states", () => {
  assert.match(source, /\/api\/analytics\/me\?mode=creator/);
  assert.match(source, /report\.content/);
  assert.match(source, /data-ct-more/);
  assert.match(source, /No posts are available to measure yet/);
  assert.match(source, /No tracked activity in this period yet/);
  assert.match(source, /data-ct-analytics-range/);
  assert.match(source, /requestCloudApi\("\/api\/creator\/content"\)/);
});

test("Creator Center uses a white compact mobile layout and solid Oldtime-blue actions", () => {
  assert.match(css, /\.ct-wrap\{[^}]*background:#fff/);
  assert.match(css, /\.ct-btn\{[^}]*background:var\(--color-primary,#1456d9\)/);
  assert.match(css, /@media\(max-width:360px\)/);
  assert.match(css, /\.ct-skel\{[^}]*animation:none/);
});
