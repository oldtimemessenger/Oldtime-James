import test from "node:test";
import assert from "node:assert/strict";
import {iconPaths,icons} from "./icons.js";
test("Save and bookmark consistently use the outlined bookmark mark", () => {
  assert.equal(iconPaths.save,iconPaths.bookmark);
  assert.match(iconPaths.bookmark,/M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17l-6-4-6 4z/);
});
test("saved and unsaved controls retain the same mark and state styling", () => {
  assert.ok(icons.bookmark.includes(iconPaths.bookmark));
  assert.ok(icons.bookmarkOn.includes(iconPaths.bookmark));
  assert.match(icons.bookmark,/fill="none"/);
  assert.match(icons.bookmarkOn,/fill="currentColor"/);
});
