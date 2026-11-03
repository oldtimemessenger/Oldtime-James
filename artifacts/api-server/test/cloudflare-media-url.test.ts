import assert from "node:assert/strict";
import test from "node:test";
import { mediaContentPath } from "../src/cloudflare/media";

test("Cloudflare media links are relative paths on the app origin", () => {
  const mediaId = "a12b34cd-5678-4abc-9def-0123456789ab";
  const path = mediaContentPath(mediaId, "token_with-safe_chars");
  const resolved = new URL(path, "https://preview.example");

  assert.equal(resolved.origin, "https://preview.example");
  assert.equal(resolved.pathname, `/api/media/${mediaId}/content`);
  assert.equal(resolved.searchParams.get("access"), "token_with-safe_chars");
});
