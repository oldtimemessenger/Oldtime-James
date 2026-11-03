import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.window = { addEventListener() {}, dispatchEvent() {} };
const { api, mutate, requestCloudApi } = await import("./store.js");

const accounts = {
  first: { id: "audit-account-a", username: "audit_a", displayName: "Account A", email: "a@example.test" },
  second: { id: "audit-account-b", username: "audit_b", displayName: "Account B", email: "b@example.test" },
};
const tokens = { first: "a".repeat(43), second: "b".repeat(43) };
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const authResponse = account => response({
  accessToken: tokens[account], expiresAt: Date.now() + 60_000,
  account: accounts[account], tokenType: "Bearer",
});

function withFetch(t, handler) {
  const original = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    if (url === "/api/auth/login") {
      return Promise.resolve(authResponse(JSON.parse(options.body).identifier));
    }
    if (url === "/api/auth/logout") return Promise.resolve(response({}, 204));
    return handler(url, options);
  };
  t.after(() => {
    api.logout();
    globalThis.fetch = original;
  });
}

test("deleting an online post waits for confirmation and removes its imported original", async t => {
  const removed = deferred();
  const remote = { id: "online-delete", sourceId: "original-delete", text: "Delete fixture",
    createdAt: Date.now(), author: accounts.first };
  withFetch(t, async (url, options) => {
    if (url === "/api/feed?limit=30&offset=0") return response({ posts: [remote] });
    assert.equal(url, "/api/posts/online-delete");
    assert.equal(options.method, "DELETE");
    return removed.promise;
  });
  await api.login("first", "fixture-password");
  mutate(state => { state.posts = [
    { id: remote.sourceId, author: api.me().id, kind: "text", caption: remote.text },
    { id: "unrelated", author: api.me().id, kind: "text", caption: "Keep me" },
  ]; });
  await api.refreshCloudFeed();
  const deletion = api.deleteCloudPost(remote.id);
  assert.ok(api.cloudPost(remote.id));
  assert.ok(api.db().posts.find(p => p.id === remote.sourceId));
  removed.resolve(response(null, 204));
  await deletion;
  assert.equal(api.cloudPost(remote.id), null);
  assert.deepEqual(api.db().posts.map(p => p.id), ["unrelated"]);
  // A stale in-flight feed response cannot resurrect a confirmed deletion.
  await api.refreshCloudFeed();
  assert.equal(api.cloudPost(remote.id), null);
});

test("failed deletion preserves both the online post and the local original", async t => {
  const remote = { id: "failed-delete", sourceId: "local-failed", text: "Keep fixture",
    createdAt: Date.now(), author: accounts.first };
  withFetch(t, async url => url === "/api/feed?limit=30&offset=0"
    ? response({ posts: [remote] }) : response({ error: "Unavailable" }, 503));
  await api.login("first", "fixture-password");
  mutate(state => { state.posts = [{ id: remote.sourceId, author: api.me().id }]; });
  await api.refreshCloudFeed();
  await assert.rejects(api.deleteCloudPost(remote.id), /Unavailable/);
  assert.ok(api.cloudPost(remote.id));
  assert.ok(api.db().posts.find(p => p.id === remote.sourceId));
});

test("delete rejects another author's post without sending a deletion request", async t => {
  withFetch(t, async url => {
    assert.equal(url, "/api/feed?limit=30&offset=0");
    return response({ posts: [{ id: "other-post", text: "Other user", createdAt: Date.now(), author: accounts.second }] });
  });
  await api.login("first", "fixture-password");
  await api.refreshCloudFeed();
  await assert.rejects(api.deleteCloudPost("other-post"), /your own/);
});

test("a delayed deletion cannot remove another account's data", async t => {
  const deleted = deferred();
  withFetch(t, async url => url === "/api/feed?limit=30&offset=0"
    ? response({ posts: [{ id: "switch-post", sourceId: "same-local-id", text: "Fixture",
      createdAt: Date.now(), author: accounts.first }] }) : deleted.promise);
  await api.login("first", "fixture-password");
  await api.refreshCloudFeed();
  const deletion = api.deleteCloudPost("switch-post");
  const rejection = assert.rejects(deletion, /account changed/);
  await api.login("second", "fixture-password");
  mutate(state => { state.posts = [{ id: "same-local-id", author: api.me().id }]; });
  deleted.resolve(response(null, 204));
  await rejection;
  assert.equal(api.db().posts.length, 1);
  assert.equal(api.cloudAccountId(), accounts.second.id);
});

test("a delayed feed and post import cannot cross an account switch", async t => {
  const feed = deferred(), imported = deferred(), importStarted = deferred();
  const importRequests = [];
  withFetch(t, async (url, options) => {
    if (url === "/api/feed?limit=30&offset=0") return feed.promise;
    if (url === "/api/posts/import") {
      importRequests.push({ token: options.headers.Authorization, body: JSON.parse(options.body) });
      importStarted.resolve();
      return imported.promise;
    }
    assert.fail(`Unexpected request: ${url}`);
  });
  await api.login("first", "fixture-password");
  mutate(state => {
    state.posts = Array.from({ length: 51 }, (_, i) => ({
      id: `original-${i}`, author: api.me().id, kind: "text",
      caption: `Original ${i}`, visibility: "public", media: [], created: 1700000000000 + i,
    }));
  });
  const loadingFeed = api.refreshCloudFeed();
  const loadingImport = api.migrateCloudTextPosts();
  const feedRejection = assert.rejects(loadingFeed, /account changed/);
  const importRejection = assert.rejects(loadingImport, /account changed/);
  await importStarted.promise;
  await api.login("second", "fixture-password");
  feed.resolve(response({ posts: [{ id: "stale-post", text: "Account A result", author: accounts.first }] }));
  imported.resolve(response({ results: importRequests[0].body.posts.map(post => ({
    sourceId: post.sourceId, postId: `saved-${post.sourceId}`, outcome: "imported",
  })) }));
  await Promise.all([feedRejection, importRejection]);
  assert.equal(api.cloudAccountId(), accounts.second.id);
  assert.deepEqual(api.cloudPosts(), []);
  assert.deepEqual(api.cloudFeedStatus(), { loaded: false, loading: false, error: "", hasMore: false });
  assert.equal(api.cloudPostMigrationStatus().accountId, null);
  assert.equal(api.cloudPostMigrationStatus().confirmed, 0);
  assert.equal(importRequests.length, 1, "the remaining batch must not be sent under account B");
  assert.equal(importRequests[0].token, `Bearer ${tokens.first}`);
  assert.equal(api.db().posts.length, 51, "original local posts must remain intact");
});

test("finishing an old feed request does not clear the newer account's loading state", async t => {
  const oldFeed = deferred(), newFeed = deferred();
  withFetch(t, async (url, options) => {
    assert.equal(url, "/api/feed?limit=30&offset=0");
    return options.headers.Authorization === `Bearer ${tokens.first}` ? oldFeed.promise : newFeed.promise;
  });
  await api.login("first", "fixture-password");
  const first = api.refreshCloudFeed();
  const firstRejected = assert.rejects(first, /account changed/);
  await api.login("second", "fixture-password");
  const second = api.refreshCloudFeed();
  oldFeed.resolve(response({ posts: [] }));
  await firstRejected;
  assert.equal(api.cloudFeedStatus().loading, true);
  newFeed.resolve(response({ posts: [] }));
  await second;
  assert.deepEqual(api.cloudFeedStatus(), { loaded: true, loading: false, error: "", hasMore: false });
});

test("account changes during body parsing also reject stale private responses", async t => {
  const body = deferred(), parsing = deferred();
  withFetch(t, async () => ({
    ok: true, status: 200, json: () => { parsing.resolve(); return body.promise; },
  }));
  await api.login("first", "fixture-password");
  const pending = requestCloudApi("/api/private-account-fixture");
  const rejected = assert.rejects(pending, /account changed/);
  await parsing.promise;
  await api.login("second", "fixture-password");
  body.resolve({ private: "account A fixture" });
  await rejected;
  assert.equal(api.cloudAccountId(), accounts.second.id);
});

test("a stale unauthorized response cannot sign out the newer account", async t => {
  const failed = deferred();
  withFetch(t, async () => failed.promise);
  await api.login("first", "fixture-password");
  const pending = requestCloudApi("/api/private-account-fixture");
  const rejected = assert.rejects(pending, /account changed/);
  await api.login("second", "fixture-password");
  failed.resolve(response({ error: "Expired" }, 401));
  await rejected;
  assert.equal(api.cloudAccountId(), accounts.second.id);
});

test("an unauthorized response for the current account clears only its session", async t => {
  withFetch(t, async () => response({ error: "Expired" }, 401));
  await api.login("first", "fixture-password");
  const originalCount = api.db().posts.length;
  await assert.rejects(requestCloudApi("/api/private-account-fixture"), error =>
    error.status === 401 && /session has expired/.test(error.message));
  assert.equal(api.cloudAccountId(), null);
  assert.equal(api.me(), null);
  assert.equal(api.db().session, null);
  assert.equal(api.db().posts.length, originalCount);
});

test("a post import is cancelled before sending if its initiating session is gone", async t => {
  let imports = 0;
  withFetch(t, async url => {
    if (url === "/api/posts/import") imports++;
    return response({});
  });
  await api.login("first", "fixture-password");
  const pending = api.migrateCloudTextPosts();
  const rejected = assert.rejects(pending, /account changed/);
  api.logout();
  await rejected;
  assert.equal(imports, 0);
});

test("editable email or username cannot relink another already-bound local account", async t => {
  withFetch(t, async () => response({}));
  await api.login("first", "fixture-password");
  const firstId = api.me().id;
  mutate(state => {
    const first = state.users.find(user => user.id === firstId);
    first.email = accounts.second.email;
    first.username = accounts.second.username;
    state.posts.push({ id: "identity-preservation-fixture", author: firstId });
  });
  await api.login("second", "fixture-password");
  assert.notEqual(api.me().id, firstId);
  assert.equal(api.db().users.find(user => user.id === firstId).cloudAccountId, accounts.first.id);
  assert.equal(api.db().posts.find(post => post.id === "identity-preservation-fixture").author, firstId);
});

test("connecting Cognito preserves the existing local owner and original posts", async t => {
  withFetch(t, async (url, options) => {
    assert.equal(url, "/api/auth/cognito/exchange");
    assert.equal(options.headers.Authorization, `Bearer ${tokens.first}`);
    return response({ accessToken: "c".repeat(43), expiresAt: Date.now() + 60_000,
      account: accounts.first, tokenType: "Bearer", authProvider: "cognito" });
  });
  await api.login("first", "fixture-password");
  const owner = api.me().id, originalPosts = structuredClone(api.db().posts);
  await api.finishCognitoSignIn({ intent: "link", code: "fixture" }, accounts.first.id);
  assert.equal(api.me().id, owner);
  assert.equal(api.authProvider(), "cognito");
  assert.deepEqual(api.db().posts, originalPosts);
});
test("a pending Cognito connection cannot attach to a different active account", async t => {
  let exchanges = 0;
  withFetch(t, async () => { exchanges++; return response({}); });
  await api.login("second", "fixture-password");
  await assert.rejects(api.finishCognitoSignIn({ intent: "link", code: "fixture" }, accounts.first.id), /account changed/);
  assert.equal(exchanges, 0);
  assert.equal(api.cloudAccountId(), accounts.second.id);
});

test("password recovery can renew the same Cognito account without relying on its previous provider session", async t => {
  withFetch(t, async (url, options) => {
    assert.equal(url, "/api/auth/cognito/exchange");
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(JSON.parse(options.body).intent, "login");
    return response({ accessToken: "d".repeat(43), expiresAt: Date.now() + 60_000,
      account: accounts.first, tokenType: "Bearer", authProvider: "cognito" });
  });
  await api.login("first", "fixture-password");
  await api.finishCognitoSignIn({ intent: "login", code: "recovery-fixture" }, accounts.first.id);
  assert.equal(api.cloudAccountId(), accounts.first.id);
});
test("a recovery response for a different Cognito identity is rejected without replacing the active account", async t => {
  withFetch(t, async () => response({ accessToken: tokens.second, expiresAt: Date.now() + 60_000,
    account: accounts.second, tokenType: "Bearer", authProvider: "cognito" }));
  await api.login("first", "fixture-password");
  const originalPosts = structuredClone(api.db().posts);
  await assert.rejects(api.finishCognitoSignIn({ intent: "login", code: "wrong-recovery-fixture" }, accounts.first.id),
    /different account/);
  assert.equal(api.cloudAccountId(), accounts.first.id);
  assert.deepEqual(api.db().posts, originalPosts);
});
test("a failed Cognito verification does not sign out the still-valid original account", async t => {
  withFetch(t, async () => response({ error: "Provider sign-in failed" }, 401));
  await api.login("first", "fixture-password");
  await assert.rejects(api.finishCognitoSignIn({ intent: "link", code: "bad-provider-fixture" }, accounts.first.id),
    /Provider sign-in failed/);
  assert.equal(api.cloudAccountId(), accounts.first.id);
});
test("an older sign-in response cannot overwrite a newer successful sign-in", async t => {
  const original = globalThis.fetch, delayed = deferred();
  globalThis.fetch = async (url, options) => {
    if (url === "/api/auth/logout") return response({});
    if (JSON.parse(options.body).identifier === "first") return delayed.promise;
    return authResponse("second");
  };
  t.after(() => { api.logout(); globalThis.fetch = original; });
  const oldLogin = api.login("first", "fixture-password");
  const rejected = assert.rejects(oldLogin, /cancelled/);
  await api.login("second", "fixture-password");
  delayed.resolve(authResponse("first"));
  await rejected;
  assert.equal(api.cloudAccountId(), accounts.second.id);
});
test("logout cancels a pending sign-in without deleting original data", async t => {
  const original = globalThis.fetch, delayed = deferred();
  globalThis.fetch = async url => url === "/api/auth/logout" ? response({}) : delayed.promise;
  t.after(() => { api.logout(); globalThis.fetch = original; });
  const oldPosts = structuredClone(api.db().posts);
  const pending = api.login("first", "fixture-password");
  const rejected = assert.rejects(pending, /cancelled/);
  api.logout();
  delayed.resolve(authResponse("first"));
  await rejected;
  assert.equal(api.me(), null);
  assert.deepEqual(api.db().posts, oldPosts);
});
