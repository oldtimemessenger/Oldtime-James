import assert from "node:assert/strict";
import test from "node:test";
import { cloudApiUrl } from "./api-origin.js";

test("keeps same-origin API URLs when no separate backend is configured", () => {
  assert.equal(cloudApiUrl("/api/auth/login"), "/api/auth/login");
});

test("keeps API calls same-origin even when an obsolete external-origin value is supplied", () => {
  assert.equal(cloudApiUrl("/api/feed?limit=30", "https://api.oldtime.example/"), "/api/feed?limit=30");
});

test("rejects URLs outside the API route", () => {
  for (const path of ["https://attacker.example/api/auth/login", "//attacker.example/api/auth/login", "/login", "/api/../profile", "/api\\profile"]) {
    assert.throws(() => cloudApiUrl(path), error =>
      error.message.includes("same-origin") || error.message.includes("within the /api/"));
  }
});
