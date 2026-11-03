import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderSavedSheet, renderShareSheet } from "./saved-sheets.js";

const appSource = await readFile(new URL("./app.js", import.meta.url), "utf8");
const commentSource = await readFile(new URL("./cloud-comments.js", import.meta.url), "utf8");
const socialControllerSource = await readFile(new URL("./social-sheets-controller.js", import.meta.url), "utf8");
const storeSource = await readFile(new URL("./store.js", import.meta.url), "utf8");

test("the feed bookmark saves immediately instead of opening the collection sheet", () => {
  const start = appSource.indexOf("function save(id)");
  const end = appSource.indexOf("\nfunction showSocialSheet", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = appSource.slice(start, end);
  assert.match(handler, /setPostSaved\(id, !wasSaved\)/);
  assert.doesNotMatch(handler, /showSocialSheet/);
  assert.match(handler, /aria-pressed/);
});

test("saved collections are not exposed by profile, save, or share screens", () => {
  assert.doesNotMatch(appSource, /listSavedCollections|data-saved-filter|profile-saved-collections/);
  assert.doesNotMatch(appSource, /allowCollections|data-share-collection/);
  assert.doesNotMatch(socialControllerSource, /data-collection-|data-share-collection|createSavedCollection/);
  assert.doesNotMatch(renderShareSheet({ post: {}, canOrganize: true }), /data-share-collection/);
  assert.doesNotMatch(renderSavedSheet(), /data-collection-/);
  const loadStart = storeSource.indexOf("async loadCloudAccountState()");
  const loadEnd = storeSource.indexOf("projectCloudSavedState()", loadStart);
  const cloudProjection = storeSource.slice(
    storeSource.indexOf("function cloudOwnedContentState"),
    storeSource.indexOf("\nfunction accountStateProjection"),
  );
  assert.notEqual(loadStart, -1);
  assert.notEqual(loadEnd, -1);
  assert.doesNotMatch(storeSource.slice(loadStart, loadEnd), /method:\s*"PUT"/);
  assert.doesNotMatch(cloudProjection, /savedCollections/);
  assert.match(storeSource, /return \{ savedPostIds: state\.savedPostIds \}/);
});

test("saved confirmation sheet keeps the save private without a collection form", () => {
  const markup = renderSavedSheet();
  assert.match(markup, /Saved privately to your account/);
  assert.doesNotMatch(markup, /data-collection-form|New collection|Collections/);
});

test("posting a comment reports that it was posted, not saved, and avoids a duplicate toast", () => {
  assert.match(commentSource, /say\("Comment posted\."\)/);
  assert.doesNotMatch(commentSource, /Comment saved/i);
  assert.doesNotMatch(commentSource, /toast\?\.\("Comment posted"\)/);
});
