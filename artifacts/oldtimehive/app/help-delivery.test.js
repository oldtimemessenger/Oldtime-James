import test from "node:test";
import assert from "node:assert/strict";
import { createHelpDeliveryGuard } from "./help-delivery.js";

const DAY = 24 * 60 * 60 * 1000;

test("delivery fallback limits repeats to the normal cooldown and isolates accounts", () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const guard = createHelpDeliveryGuard(storage);
  const secondTab = createHelpDeliveryGuard(storage);
  guard.suppress("account-a", DAY);
  assert.equal(guard.isSuppressed("account-a", DAY + 2 * DAY), true);
  assert.equal(secondTab.isSuppressed("account-a", DAY + 2 * DAY), true);
  assert.equal(guard.isSuppressed("account-a", DAY + 3 * DAY), false);
  assert.equal(guard.isSuppressed("account-b", DAY + 2 * DAY), false);
});

test("blocked browser storage does not prevent a tip from being attempted", () => {
  const storage = {
    getItem() { throw new Error("Storage unavailable"); },
    setItem() { throw new Error("Storage unavailable"); },
  };
  const guard = createHelpDeliveryGuard(storage);
  assert.equal(guard.isSuppressed("account-a"), false);
  guard.suppress("account-a");
  assert.equal(guard.isSuppressed("account-a"), true);
});
