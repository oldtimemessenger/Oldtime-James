import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectStartupAssets } from "../artifacts/oldtimehive/pwa-build.ts";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("Pages config serves the existing build and binds the API Worker", async () => {
  const config = await readFile(
    path.join(workspaceRoot, "artifacts/oldtimehive/wrangler.toml"),
    "utf8",
  );
  assert.match(config, /name = "oldtimehive"/);
  assert.match(config, /pages_build_output_dir = "\.\/dist\/public"/);
  assert.match(config, /binding = "OLDTIME_API"/);
  assert.match(config, /service = "oldtime-api"/);
});

test("the Pages API route forwards the original same-origin request", async () => {
  const { onRequest } = await import(
    "../artifacts/oldtimehive/functions/api/[[path]].js"
  );
  const request = new Request("https://oldtimehive.pages.dev/api/health");
  let forwarded;
  const response = await onRequest({
    request,
    env: {
      OLDTIME_API: {
        fetch: async incoming => {
          forwarded = incoming;
          return new Response("ok", { status: 200 });
        },
      },
    },
  });

  assert.equal(forwarded, request);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ok");
});

test("the Pages API route fails explicitly if its binding is missing", async () => {
  const { onRequest } = await import(
    "../artifacts/oldtimehive/functions/api/[[path]].js"
  );
  const response = await onRequest({
    request: new Request("https://oldtimehive.pages.dev/api/feed"),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("the production build does not require a separate API origin", async () => {
  const script = await readFile(
    path.join(workspaceRoot, "scripts/cloudflare-pages-build.mjs"),
    "utf8",
  );
  assert.match(script, /@workspace\/oldtimehive/);
  assert.doesNotMatch(script, /VITE_API_BASE_URL/);
});

test("offline startup pre-caches the app shell, not lazy feature chunks", () => {
  const bundle = {
    "assets/entry-12345678.js": {
      type: "chunk",
      fileName: "assets/entry-12345678.js",
      isEntry: true,
      imports: [],
      dynamicImports: ["assets/app-12345678.js"],
    },
    "assets/app-12345678.js": {
      type: "chunk",
      fileName: "assets/app-12345678.js",
      imports: ["assets/shared-12345678.js"],
      dynamicImports: ["assets/maplibre-12345678.js", "assets/charts-12345678.js"],
      viteMetadata: { importedCss: new Set(["assets/app-12345678.css"]) },
    },
    "assets/shared-12345678.js": {
      type: "chunk",
      fileName: "assets/shared-12345678.js",
      imports: [],
      dynamicImports: [],
    },
    "assets/maplibre-12345678.js": {
      type: "chunk",
      fileName: "assets/maplibre-12345678.js",
      imports: [],
      dynamicImports: [],
    },
    "assets/charts-12345678.js": {
      type: "chunk",
      fileName: "assets/charts-12345678.js",
      imports: [],
      dynamicImports: [],
    },
  };

  assert.deepEqual(collectStartupAssets(bundle), [
    "assets/entry-12345678.js",
    "assets/app-12345678.js",
    "assets/app-12345678.css",
    "assets/shared-12345678.js",
  ]);
});
