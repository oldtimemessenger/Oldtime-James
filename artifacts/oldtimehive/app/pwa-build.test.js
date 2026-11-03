import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

test("service worker ignores API responses, authenticated requests, writes and unknown media", () => {
  const events = {};
  const source = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8")
    .replace('"__BUILD_VERSION__"', '"test"')
    .replace('["__PRECACHE_FILES__"]', '["./index.html","./assets/app-test.js"]');
  vm.runInNewContext(source, {
    self: { registration: { scope: "https://example.test/" }, location: { origin: "https://example.test" },
      addEventListener: (name, handler) => { events[name] = handler; } },
    URL, Set, Response,
    caches: { match: async () => new Response("cached public asset") },
  });
  for (const request of [
    new Request("https://example.test/api/feed"),
    new Request("https://example.test/api"),
    new Request("https://example.test/assets/app-test.js", { headers: { Authorization: "Bearer test-only" } }),
    new Request("https://example.test/assets/app-test.js", { method: "POST", body: "fixture" }),
    new Request("https://example.test/private-photo.jpg"),
    new Request("https://foreign.test/assets/app-test.js"),
  ]) {
    events.fetch({ request, respondWith: () => assert.fail("Private or unrelated resource was intercepted") });
  }
  let cached = false;
  events.fetch({ request: new Request("https://example.test/assets/app-test.js"),
    respondWith: () => { cached = true; } });
  assert.equal(cached, true);
});

test("Oldtime remains a mobile-first installable PWA with iOS safe-area support", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  const visual = readFileSync(new URL("./app-wide-visual-language.css", import.meta.url), "utf8");
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.equal(manifest.display, "standalone");
  assert.match(manifest.start_url, /^\.\//);
  assert.match(app, /import "\.\/app-wide-visual-language\.css"/);
  assert.match(visual, /@media \(hover:none\) and \(pointer:coarse\)/);
  assert.match(visual, /height:100dvh/);
  assert.match(visual, /env\(safe-area-inset-bottom,0px\)/);
  assert.match(visual, /-webkit-overflow-scrolling:touch/);
});
