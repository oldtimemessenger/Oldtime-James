import test from "node:test";
import assert from "node:assert/strict";
import { createTransientComments } from "../app/transient-comments.js";

test("remounting a refreshed viewer does not replay expired comments", () => {
  const c = clock(), seenIds = new Set();
  const first = createTransientComments({ schedule:c.schedule, cancel:c.cancel, seenIds });
  first.sync(["old"]); c.advance(7000);
  assert.equal(first.phase("old"), "hidden"); first.dispose();
  const second = createTransientComments({ schedule:c.schedule, cancel:c.cancel, seenIds });
  second.sync(["old","new"]);
  assert.equal(second.phase("old"), "hidden");
  assert.equal(second.phase("new"), "visible");
  c.advance(7500); assert.equal(second.phase("new"), "hidden"); second.dispose();
});

function clock() {
  let at = 0, next = 0;
  const tasks = new Map();
  return {
    schedule(fn, ms) { const id = ++next; tasks.set(id, { at: at + ms, fn }); return id; },
    cancel(id) { tasks.delete(id); },
    advance(ms) {
      const end = at + ms;
      for (;;) {
        const due = [...tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        at = due[1].at; tasks.delete(due[0]); due[1].fn();
      }
      at = end;
    },
    pending: () => tasks.size,
  };
}
test("comments enter, leave, disappear and do not restart on refresh", () => {
  const c = clock(), stream = createTransientComments(c);
  stream.sync(["one", "two"]);
  assert.equal(stream.phase("one"), "visible");
  c.advance(6000); assert.equal(stream.phase("one"), "leaving");
  c.advance(420); assert.equal(stream.phase("one"), "hidden");
  c.advance(300); assert.equal(stream.phase("two"), "hidden");
  stream.sync(["one", "two"]);
  assert.equal(stream.phase("one"), "hidden");
  stream.sync(["one", "two", "three"]);
  assert.equal(stream.phase("three"), "visible");
  stream.dispose(); assert.equal(c.pending(), 0);
});
test("reading restores history, pauses expiry, then resumes after inactivity", () => {
  const c = clock(), stream = createTransientComments(c);
  stream.sync(["one"]); c.advance(6500);
  assert.equal(stream.phase("one"), "hidden");
  stream.read(); assert.equal(stream.phase("one"), "visible");
  c.advance(7000); stream.read(); c.advance(7000);
  assert.equal(stream.phase("one"), "visible");
  stream.sync(["one", "new"]);
  assert.equal(stream.phase("new"), "visible");
  c.advance(1000); c.advance(720);
  assert.equal(stream.phase("new"), "hidden");
  stream.dispose(); assert.equal(c.pending(), 0);
});
test("disposing a viewer cancels all comment and reading timers", () => {
  const c = clock(), stream = createTransientComments(c);
  stream.sync(["one"]); stream.read(); stream.dispose();
  c.advance(20000);
  assert.equal(c.pending(), 0);
});
