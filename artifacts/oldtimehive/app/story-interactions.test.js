import test from "node:test";
import assert from "node:assert/strict";
import { createBurst, validateStoryComment, insertAtCursor, createPause, createPressPause, createVisibilityPolling, STORY_HOLD_DELAY_MS, isIgnoredTap, MAX_BURSTS, REPLY_FADE_MS, REPLY_FADE_STAGGER_MS, storyReplyFadeDelay } from "./story-interactions.js";

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
test("Story reply validation trims input and rejects empty or oversized text", () => {
  assert.equal(validateStoryComment("  hi  "), "hi");
  assert.throws(() => validateStoryComment("  "), /Write a reply/);
  assert.throws(() => validateStoryComment("x".repeat(301)), /300/);
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
test("Story chat fades older top replies before newer replies", () => {
  assert.equal(storyReplyFadeDelay(0), REPLY_FADE_MS);
  assert.equal(storyReplyFadeDelay(1), REPLY_FADE_MS + REPLY_FADE_STAGGER_MS);
  assert.ok(storyReplyFadeDelay(2) > storyReplyFadeDelay(1));
});
test("control taps are ignored", () => {
  assert.equal(isIgnoredTap({ closest: s => s.includes("button") ? {} : null }), true);
  assert.equal(isIgnoredTap({ closest: () => null }), false);
  assert.equal(isIgnoredTap({ closest: selector => selector.split(",").includes("canvas") ? {} : null }), false, "read-only creative story canvases allow repeated visual hearts");
});

test("Story hold pauses after a short threshold and suppresses the resulting tap", () => {
  const timers = new Map(); let id = 0; const log = [];
  const press = createPressPause({
    hold: () => log.push("pause"), release: () => log.push("resume"),
    setTimer: fn => (timers.set(++id, fn), id), clearTimer: key => timers.delete(key),
  });
  press.start({ pointerId: 4, button: 0, clientX: 10, clientY: 20 });
  assert.equal(timers.size, 1);
  assert.equal(STORY_HOLD_DELAY_MS, 180);
  [...timers.values()][0]();
  assert.deepEqual(log, ["pause"]);
  press.end({ pointerId: 4 });
  assert.deepEqual(log, ["pause", "resume"]);
  assert.equal(press.consumeClick(), true);
  assert.equal(press.consumeClick(), false);
});

test("short Story taps do not pause or suppress the tap", () => {
  const timers = new Map(); let id = 0; const log = [];
  const press = createPressPause({
    hold: () => log.push("pause"), release: () => log.push("resume"),
    setTimer: fn => (timers.set(++id, fn), id), clearTimer: key => timers.delete(key),
  });
  press.start({ pointerId: 2, button: 0, clientX: 1, clientY: 1 });
  press.end({ pointerId: 2 });
  assert.deepEqual(log, []);
  assert.equal(timers.size, 0);
  assert.equal(press.consumeClick(), false);
});

test("Story hold cancels on movement and releases when interrupted", () => {
  const timers = new Map(); let id = 0; const log = [];
  const press = createPressPause({
    hold: () => log.push("pause"), release: () => log.push("resume"),
    setTimer: fn => (timers.set(++id, fn), id), clearTimer: key => timers.delete(key),
  });
  press.start({ pointerId: 7, button: 0, clientX: 0, clientY: 0 });
  press.move({ pointerId: 7, clientX: 30, clientY: 0 });
  assert.equal(timers.size, 0);
  assert.deepEqual(log, []);
  press.start({ pointerId: 8, button: 0, clientX: 0, clientY: 0 });
  [...timers.values()][0]();
  press.cancel({ pointerId: 8 });
  assert.deepEqual(log, ["pause", "resume"]);
  assert.equal(press.consumeClick(), false);
  press.dispose();
});


test("Story reply polling pauses in the background and resumes once visible", () => {
  const listeners = new Map(), timers = new Map();
  let nextTimer = 0, polls = 0;
  const doc = {
    hidden: false,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
  };
  const polling = createVisibilityPolling({
    document: doc,
    poll: () => { polls++; },
    delay: 5000,
    setIntervalFn: fn => { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearIntervalFn: id => timers.delete(id),
  });

  assert.equal(polls, 1, "poll immediately when the visible Story opens");
  assert.equal(polling.isActive(), true);
  assert.equal(timers.size, 1);

  doc.hidden = true;
  listeners.get("visibilitychange")();
  assert.equal(polling.isActive(), false);
  assert.equal(timers.size, 0);

  doc.hidden = false;
  listeners.get("visibilitychange")();
  assert.equal(polls, 2, "refresh once when the app becomes visible");
  assert.equal(polling.isActive(), true);
  [...timers.values()][0]();
  assert.equal(polls, 3, "continue the normal foreground interval");

  polling.dispose();
  assert.equal(polling.isActive(), false);
  assert.equal(timers.size, 0);
  assert.equal(listeners.size, 0, "remove the visibility listener on disposal");
});

test("Story reply polling respects disabled replies and never restarts after disposal", () => {
  const listeners = new Map(), timers = new Map();
  let nextTimer = 0, polls = 0, enabled = false;
  const doc = {
    hidden: false,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
  };
  const polling = createVisibilityPolling({
    document: doc,
    poll: () => { polls++; },
    shouldPoll: () => enabled,
    setIntervalFn: fn => { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearIntervalFn: id => timers.delete(id),
  });
  assert.equal(polls, 0);
  assert.equal(polling.isActive(), false);

  enabled = true;
  polling.start();
  assert.equal(polls, 1);
  assert.equal(polling.isActive(), true);
  polling.stop();
  assert.equal(polling.isActive(), false);
  polling.dispose();
  polling.start();
  assert.equal(polls, 1, "disposed poller must remain inactive");
  assert.equal(timers.size, 0);
  assert.equal(listeners.size, 0);
});
