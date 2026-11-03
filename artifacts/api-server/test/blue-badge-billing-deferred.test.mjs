import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("unconfigured Blue Badge purchases are not exposed in the Cloudflare API", () => {
  const contract = read("../../../lib/api-spec/openapi.yaml");
  assert.doesNotMatch(contract, /\/badge\/(?:purchase|gift|redeem|checkout)|\/memberships|\/stripe/);
  const worker = read("../src/cloudflare/worker.ts");
  assert.doesNotMatch(worker, /createCheckoutSession|grantMembership|verifyStoreReceipt/);
});

test("the preview is the Cloudflare relay rather than a separate membership backend", () => {
  const pkg = JSON.parse(read("../package.json"));
  assert.match(pkg.scripts.dev, /cloudflare-preview-gateway\.mjs/);
  assert.doesNotMatch(pkg.scripts.dev, /src\/index|src\/app/);
});
