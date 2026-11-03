import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const app = read("./app.js"), store = read("./store.js"), status = read("./status-capture.js");
const sharing = await import(`data:text/javascript;base64,${Buffer.from(read("./status-sharing.js").replace(/^import .*;\n/gm, "")).toString("base64")}`);
const postId = "11111111-1111-4111-8111-111111111111", commentId = "22222222-2222-4222-8222-222222222222";
test("shared Status links resolve canonical post paths and comment targets", () => {
  assert.deepEqual(sharing.sharedStatusTarget(`https://heyoldtime.com/p/${postId}?comment=${commentId}`), { postId, commentId });
  assert.deepEqual(sharing.sharedStatusTarget(`https://example.test/?post=${postId}`), { postId, commentId: "" });
  for (const value of ["ordinary text", "javascript:alert(1)", "https://example.test/?post=invalid", `https://example.test/p/${postId}?comment=invalid`]) {
    assert.equal(sharing.sharedStatusTarget(value), null);
  }
});
test("Status has no numerical send/preparation counter and revalidates shared content", () => {
  const send = status.slice(status.indexOf("  async function send()"));
  assert.doesNotMatch(send, /Sending \$|Preparing video \$|Math\.round/);
  assert.equal((send.match(/await validateSource\?\.\(\)/g) || []).length, 2);
  assert.match(send, /text: joinLabelText\(project\.layers, shareText\)/);
  assert.match(app, /destination: "story", \.\.\.seed, shareText: postPublicLink/);
  assert.match(app, /showTypeFilters: true/);
});
test("online comments use the complete Reply and Share panel, not the reduced fallback", () => {
  const comments = app.slice(app.indexOf("function comments("), app.indexOf("function openStory("));
  assert.doesNotMatch(comments, /openCloudComments/);
  for (const marker of ["data-reply", "data-comment-share", "data-action-story", "parentId: parent || null", "isCurrent()"]) assert.ok(comments.includes(marker), marker);
  assert.match(store, /comments: cloudPostComments\.get\(post\.id\) \|\| \[\]/);
});
function storeMethod(name, next, dependencies) {
  const source = store.slice(store.indexOf(`  async ${name}(`), store.indexOf(`  async ${next}(`)).trim();
  return Function(...Object.keys(dependencies), `return ({${source}}).${name};`)(...Object.values(dependencies));
}
test("a delayed Story poll cannot erase a confirmed reply", async () => {
  let resolve;
  const story = { id: postId, comments: [] }, comments = new Map(), versions = new Map();
  const session = { accessToken: "local-test", account: { id: "viewer" } };
  const load = storeMethod("loadCloudStoryComments", "recordCloudStoryView", {
    getCloudSession: () => session, cloudStories: [story], cloudStoryComments: comments, cloudStoryCommentVersions: versions,
    cloudRequest: () => new Promise(done => { resolve = done; }),
  });
  const pending = load(postId);
  const confirmed = [{ id: commentId, text: "A confirmed reply" }];
  versions.set(postId, 1); comments.set(postId, confirmed); story.comments = confirmed;
  resolve({ comments: [] });
  assert.deepEqual(await pending, confirmed);
  assert.deepEqual(story.comments, confirmed);
});
test("a delayed post-comment load cannot erase a confirmed discussion", async () => {
  let resolve;
  const confirmed = [{ id: commentId, body: "Saved comment", replies: [] }];
  const cache = new Map(), versions = new Map();
  const session = { accessToken: "local-test", account: { id: "viewer" } };
  const load = storeMethod("loadCloudPostComments", "createCloudPostComment", {
    getCloudSession: () => session, cloudPostComments: cache, cloudPostCommentVersions: versions,
    cloudRequest: () => new Promise(done => { resolve = done; }),
    cloudAuthorId: author => author.id, forEachCloudPostCopy: () => assert.fail("Stale data must not touch cached posts"),
  });
  const pending = load(postId);
  versions.set(postId, 1); cache.set(postId, confirmed);
  resolve({ comments: [], total: 0 });
  assert.deepEqual(await pending, confirmed);
});
test("a confirmed reply survives a refresh failure and updates all cached post copies", async () => {
  const root = { id: postId, body: "Parent", replies: [] };
  const cache = new Map([[postId, [root]]]), versions = new Map();
  const copies = [{ comments: [root], commentCount: 1 }, { comments: [], commentCount: 1 }];
  const session = { accessToken: "local-test", account: { id: "viewer" } };
  const create = storeMethod("createCloudPostComment", "setCloudPostCommentReaction", {
    getCloudSession: () => session, cloudPostComments: cache, cloudPostCommentVersions: versions,
    cloudRequest: async () => ({ id: commentId, parentId: postId, body: "Reply", author: { id: "viewer" }, createdAt: 10 }),
    cloudAuthorId: author => author.id, forEachCloudPostCopy: (_id, update) => copies.forEach(update),
  });
  const result = await create.call({
    me: () => ({ id: "viewer" }), post: () => copies[0],
    loadCloudPostComments: async () => { throw new Error("Expected test refresh failure"); },
  }, postId, { body: "Reply", parentId: postId });
  assert.equal(result.id, commentId);
  assert.equal(cache.get(postId)[0].replies[0].id, commentId);
  for (const copy of copies) { assert.equal(copy.comments, cache.get(postId)); assert.equal(copy.commentCount, 2); }
});
test("Cloudflare accepts an owner's reaction without counting an owner view", () => {
  const worker = read("../../api-server/src/cloudflare/stories.ts");
  const reaction = worker.slice(worker.indexOf('if(action==="reactions")'), worker.indexOf('if(action==="activity"'));
  assert.doesNotMatch(reaction, /s\.author_id===userId|another account/);
  assert.match(worker, /if\(s\.author_id!==userId\)await db\.prepare\("INSERT INTO story_views/);
});
