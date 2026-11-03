import test from "node:test";
import assert from "node:assert/strict";
import { createBurst, saveStoryComment, setStorySaved, insertAtCursor, createPause, isIgnoredTap, MAX_BURSTS } from "./story-interactions.js";

const node = () => { const n = { style: { setProperty() {} }, removed: false, setAttribute() {}, remove() { n.removed = true; } }; return n; };
const host = () => ({ nodes: [], append(n) { this.nodes.push(n); } });
test("bursts are bounded, expire and clean up", () => {
  const timers = new Map(); let id = 0; const h = host();
  const b = createBurst({ host: h, create: node, setTimer: fn => (timers.set(++id, fn), id), clearTimer: t => timers.delete(t) });
  for (let i = 0; i < 30; i++) b.spawn(i, i);
  assert.equal(b.count(), MAX_BURSTS); assert.equal(h.nodes.filter(n => !n.removed).length, MAX_BURSTS);
  [...timers.values()][0](); assert.equal(b.count(), MAX_BURSTS - 1);
  b.dispose(); assert.equal(b.count(), 0); assert.equal(timers.size, 0);
});
test("reduced motion spawns nothing", () => {
  const b = createBurst({ host: host(), create: node, reduced: true }); assert.equal(b.spawn(1, 1), null); assert.equal(b.count(), 0);
});
const world = (over = {}) => {
  const db = { stories: [{ id: "s1", author: "u2", created: 1000 }] };
  return { db, api: { me: () => ({ id: "u1" }), db: () => db, canSeeStory: () => true, ...over },
    mutate: fn => fn(db) };
};
test("saves a local comment on a visible story", () => {
  const { db, api, mutate } = world();
  const c = saveStoryComment({ api, mutate, storyId: "s1", ownerId: "u1", text: "  hi  ", now: 2000 });
  assert.equal(c.text, "hi"); assert.equal(c.local, true); assert.equal(db.stories[0].comments.length, 1);
});
test("explicit errors, nothing saved", () => {
  for (const [over, ownerId, text, msg] of [[{}, "u9", "x", /session/], [{}, "u1", "  ", /Write/], [{ canSeeStory: () => false }, "u1", "x", /can't comment/], [{}, "u1", "x".repeat(301), /300/]]) {
    const { db, api, mutate } = world(over);
    assert.throws(() => saveStoryComment({ api, mutate, storyId: "s1", ownerId, text, now: 2000 }), msg);
    assert.equal(db.stories[0].comments, undefined);
  }
  const { api, mutate } = world();
  assert.throws(() => saveStoryComment({ api, mutate, storyId: "s1", ownerId: "u1", text: "x", now: 1000 + 864e5 }), /no longer/);
  assert.throws(() => saveStoryComment({ api, mutate, storyId: "none", ownerId: "u1", text: "x", now: 2000 }), /no longer/);
});
test("story owner can keep an active story on their profile and later unkeep it", () => {
  const db = { stories: [{ id: "s1", author: "u1", created: 1000 }] };
  const api = { me: () => ({ id: "u1" }), db: () => db };
  const mutate = fn => fn(db);
  assert.equal(setStorySaved({ api, mutate, storyId: "s1", ownerId: "u1", saved: true, now: 2000 }), true);
  assert.equal(db.stories[0].savedToProfile, true);
  assert.equal(setStorySaved({ api, mutate, storyId: "s1", ownerId: "u1", saved: false, now: 2000 }), false);
  assert.equal(db.stories[0].savedToProfile, false);
  assert.throws(() => setStorySaved({ api, mutate, storyId: "s1", ownerId: "u1", saved: true, now: 1000 + 864e5 }), /expired/);
});
test("emoji insertion respects cursor and limit", () => {
  assert.deepEqual(insertAtCursor("abcd", 2, 2, "X"), { value: "abXcd", cursor: 3 });
  assert.deepEqual(insertAtCursor("abcd", 1, 3, "X"), { value: "aXd", cursor: 2 });
  assert.equal(insertAtCursor("a".repeat(300), 0, 0, "X").value.length, 300);
});
test("pause is reference counted", () => {
  const log = []; const p = createPause({ onPause: () => log.push("p"), onResume: () => log.push("r") });
  p.hold(); p.hold(); p.release(); assert.deepEqual(log, ["p"]); p.release(); p.release(); assert.deepEqual(log, ["p", "r"]);
});
test("control taps are ignored", () => {
  assert.equal(isIgnoredTap({ closest: s => s.includes("button") ? {} : null }), true);
  assert.equal(isIgnoredTap({ closest: () => null }), false);
  assert.equal(isIgnoredTap({ closest: selector => selector.split(",").includes("canvas") ? {} : null }), false, "read-only creative story canvases allow repeated visual hearts");
});
