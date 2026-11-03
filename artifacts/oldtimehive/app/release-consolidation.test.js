import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

test("Oldtime owns its release implementation without importing another app", async () => {
  const entry = await readFile(new URL("./release-entry.js", import.meta.url), "utf8");
  assert.match(entry, /await import\("\.\/app\.js"\)/);
  assert.match(entry, /if \(localStorage\.getItem\(freshStartMarker\) !== "done"\) \{[\s\S]*fetch\("\/api\/healthz"/);
  assert.doesNotMatch(entry, /oldtime-technologies/);
  await access(new URL("./app.js", import.meta.url));
  const previousAddress = await readFile(new URL("../../oldtime-technologies/index.html", import.meta.url), "utf8");
  assert.match(previousAddress, /location\.replace/);
  assert.doesNotMatch(previousAddress, /src="app\/app\.js"/);
});

test("chat and rare interaction tools stay out of the initial app bundle", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  for (const module of ["chat.js", "profile-image-cropper.js", "place-picker.js", "audio-panel.js"]) {
    assert.doesNotMatch(app, new RegExp(`^import .* from ["']\\./${module}["'];?$`, "m"));
    assert.match(app, new RegExp(`import\\(["']\\./${module}["']\\)`));
  }
  assert.doesNotMatch(app, /^import .* from ["']\.\/blast\.js["'];?$/m);
  assert.match(app, /from ["']\.\/blast-guidance-state\.js["']/);
});
