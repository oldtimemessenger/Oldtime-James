import test from "node:test";
import assert from "node:assert/strict";
import { mergeFeedPosts, followingPosts, relationshipPosts } from "./feed-posts.js";

test("Following contains only posts from accounts the viewer follows", () => {
  const me = { id: "me", following: ["followed"], friends: ["friend"] };
  const cloud = [
    { id: "own", author: "me" },
    { id: "followed", author: "followed" },
    { id: "followed-repost", author: "stranger", repostedByFriends: [{ id: "followed" }] },
    { id: "friend", author: "friend" },
    { id: "stranger", author: "stranger" },
  ];
  assert.deepEqual(followingPosts(mergeFeedPosts([], cloud), me).map(post => post.id), ["followed", "followed-repost"]);
  assert.deepEqual(followingPosts(cloud, null), [], "missing account context must fail closed");
});
test("For You includes own posts, followed accounts, and accepted friends only", () => {
  const me = { id: "me", following: ["followed"], friends: ["friend"] };
  const posts = [
    { id: "own", author: "me" },
    { id: "followed", author: { id: "followed" } },
    { id: "friend", author: "friend" },
    { id: "friend-repost", author: "stranger", repostedByFriends: [{ id: "friend" }] },
    { id: "stranger", author: "stranger" },
  ];
  assert.deepEqual(relationshipPosts(posts, me).map(post => post.id), ["own", "followed", "friend", "friend-repost"]);
  assert.deepEqual(relationshipPosts(posts, null), []);
});
test("cloud records replace imported legacy versions without duplicates", () => {
  const cloud = [{ id: "new", sourceId: "legacy", author: "me" }];
  assert.deepEqual(mergeFeedPosts([{ id: "legacy" }, { id: "new" }, { id: "unmigrated" }], cloud),
    [{ id: "unmigrated" }, ...cloud]);
});
