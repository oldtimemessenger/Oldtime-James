import test from "node:test";
import assert from "node:assert/strict";
import { notificationGroup, filterNotificationGroup, notificationGroupCounts } from "./notification-groups.js";

test("notification groups separate followers, reactions and conversations without inventing counts", () => {
  const notes = [
    { kind: "follow", actor: "one" }, { kind: "like", actor: "two" },
    { kind: "comment", actor: "one" }, { kind: "mention", actor: "two" },
    { kind: "share", actor: "three" }, { kind: "story-reaction", actor: "one" },
    { kind: "account-update", actor: "one" },
  ];
  assert.deepEqual(notificationGroupCounts(notes), { followers: 1, likes: 2, comments: 3, activity: 1 });
  assert.equal(filterNotificationGroup(notes, "following", ["two"]).length, 2);
  assert.equal(filterNotificationGroup(notes, "everything").length, notes.length);
});

test("private saved-post actions are never exposed as notifications", () => {
  const notes = [{ kind: "save" }, { kind: "post-save" }, { kind: "saved" }, { kind: "like" }];
  assert.equal(notificationGroup(notes[0]), null);
  assert.deepEqual(notificationGroupCounts(notes), { likes: 1 });
  assert.deepEqual(filterNotificationGroup(notes, "all"), [{ kind: "like" }]);
});
