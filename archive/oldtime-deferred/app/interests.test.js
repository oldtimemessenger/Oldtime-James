import test from "node:test";
import assert from "node:assert/strict";
import { readInterests, saveInterests, resetInterests, interestContext } from "./interests.js";
const mem = () => { const d = new Map(); return { getItem: k => d.get(k) ?? null, setItem: (k, v) => d.set(k, v), removeItem: k => d.delete(k) }; };
test("interests are per account, validated, resettable and disableable", () => {
  const s = mem();
  assert.equal(interestContext("a", s).interestsSet, false);
  assert.deepEqual(saveInterests("a", { selected: ["Sports", "Sports", "Bogus"] }, s), ["Sports"]);
  assert.deepEqual(interestContext("a", s), { interests: ["Sports"], interestsSet: true });
  assert.equal(interestContext("b", s).interestsSet, false);
  saveInterests("a", { enabled: false, selected: ["Music"] }, s);
  assert.deepEqual(interestContext("a", s).interests, []);
  resetInterests("a", s);
  assert.equal(readInterests("a", s).decided, false);
});
test("unreadable storage never prompts", () => {
  const bad = { getItem: () => "{oops", setItem() {}, removeItem() {} };
  assert.equal(interestContext("a", bad).interestsSet, true);
});
