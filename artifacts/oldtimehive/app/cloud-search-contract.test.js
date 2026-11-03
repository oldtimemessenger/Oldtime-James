import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("account search matches the Cloudflare Worker query and response contract", async () => {
  const [app, worker] = await Promise.all([
    readFile(new URL("./app.js", import.meta.url), "utf8"),
    readFile(new URL("../../api-server/src/cloudflare/social.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /\/api\/users\/search\?q=\$\{encodeURIComponent\(query\)\}/);
  assert.match(app, /Array\.isArray\(result\?\.users\)/);
  assert.match(app, /profiles: result\.users/);
  assert.match(worker, /searchParams\.get\("q"\)/);
  assert.match(worker, /return json\(\{users:accounts\.map/);
  assert.doesNotMatch(app, /\/api\/users\/search\?query=/);
});
