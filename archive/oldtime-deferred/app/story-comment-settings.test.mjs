import { test } from "node:test";
import assert from "node:assert/strict";
import { setStoryComments, saveStoryComment } from "./story-interactions.js";
const fixture = () => {
  const db = { stories: [{ id: "story", author: "owner", created: Date.now(), comments: [{ id: "old", text: "Keep this" }] }] };
  let viewer = "owner";
  return { db, api: { me: () => ({ id: viewer }), db: () => db, canSeeStory: () => true }, mutate: fn => fn(db), viewer: id => { viewer = id; } };
};
test("the owner can turn comments off and back on without deleting older comments", () => {
  const f = fixture();
  setStoryComments({ ...f, storyId: "story", ownerId: "owner", enabled: false });
  assert.throws(() => saveStoryComment({ ...f, storyId: "story", ownerId: "owner", text: "New" }), /turned off/);
  assert.equal(f.db.stories[0].comments.length, 1);
  setStoryComments({ ...f, storyId: "story", ownerId: "owner", enabled: true });
  saveStoryComment({ ...f, storyId: "story", ownerId: "owner", text: "New" });
  assert.equal(f.db.stories[0].comments.length, 2);
});
test("another viewer cannot change the owner's comment setting", () => {
  const f = fixture(); f.viewer("other");
  assert.throws(() => setStoryComments({ ...f, storyId: "story", ownerId: "other", enabled: false }), /Only the Story owner/);
  assert.throws(() => setStoryComments({ ...f, storyId: "story", ownerId: "owner", enabled: false }), /session/);
});
