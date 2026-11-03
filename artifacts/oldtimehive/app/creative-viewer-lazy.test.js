import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("creative canvas rendering is loaded only when a creative canvas is present", async () => {
  const [app, markup, viewer] = await Promise.all([
    readFile(new URL("./app.js", import.meta.url), "utf8"),
    readFile(new URL("./creative-markup.js", import.meta.url), "utf8"),
    readFile(new URL("./creative-viewer.js", import.meta.url), "utf8"),
  ]);

  assert.match(app, /import \{ creativeMediaMarkup, creativeAttribution \} from "\.\/creative-markup\.js"/);
  assert.doesNotMatch(app, /from "\.\/creative-viewer\.js"/);
  assert.match(app, /import\("\.\/creative-viewer\.js"\)/);
  assert.match(app, /root\?\.isConnected[\s\S]*?canvas\[data-creative-id\]/);
  assert.match(app, /if \(root\.isConnected\) module\.mountCreativeViewers\(root, options\)/);

  assert.match(markup, /export function creativeMediaMarkup/);
  assert.match(markup, /export function creativeAttribution/);
  assert.match(markup, /export function creativeAspect/);
  assert.doesNotMatch(markup, /creative-renderer|creative-responses|creative-content|creative-video-edit|creative-editor\.css/);

  assert.match(viewer, /import \{ CreativeAssets, drawProject \} from "\.\/creative-renderer\.js"/);
  assert.match(viewer, /export \{ creativeMediaMarkup, creativeAttribution, creativeAspect \} from "\.\/creative-markup\.js"/);
});
