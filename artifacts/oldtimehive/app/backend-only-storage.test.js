import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
async function modules(directory = root) {
  const files = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(files.map(file => file.isDirectory() ? modules(join(directory, file.name))
    : file.name.endsWith(".js") && !file.name.includes(".test.") ? [join(directory, file.name)] : []))).flat();
}
test("release modules cannot add browser content databases or local durable feature writers", async () => {
  for (const file of await modules()) {
    const source = await readFile(file, "utf8");
    if (/indexedDB/.test(source)) {
      assert.doesNotMatch(source, /(?:objectStore\([^)]*\)|\bstore)\s*\.\s*(?:put|add)\s*\(/, file);
    }
    if (/localStorage\.setItem/.test(source)) {
      if (file.endsWith("/store.js")) {
        assert.match(source, /if \(!allowsTestOnlyLocalAccount\(\) \|\| getCloudSession\(\)\) return;/);
      } else if (/\/blast-(?:store|video-note-store)\.js$/.test(file)) {
        // This write only removes confirmed entries, preserving other owners.
        assert.match(source, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(remaining\)\)/);
      } else if (file.endsWith("/release-entry.js")) {
        // The sole launch-time write is a one-time marker, gated by Cloudflare's fresh-start health response.
        assert.match(source, /status\?\.provider === "cloudflare"[\s\S]*status\.freshStart === "oldtime-cloudflare-v1"/);
        assert.match(source, /localStorage\.setItem\(freshStartMarker, "done"\)/);
        assert.doesNotMatch(source, /localStorage\.clear\s*\(/);
        assert.match(source, /await import\("\.\/app\.js"\)/);
      } else {
        assert.fail(`Unexpected browser localStorage writer: ${file}`);
      }
    }
  }
});
