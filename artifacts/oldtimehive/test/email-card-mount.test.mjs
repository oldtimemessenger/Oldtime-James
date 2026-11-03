import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { shouldShowEmailReminder, EMAIL_REMINDER_ID } from "../app/email-verification-reminder.js";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
function harness() {
  const events = [];
  const state = { items: {}, paused: false };
  const account = { emailVerified: false, joinedAt: Date.now() - 30 * 86400000 };
  const slot = {
    connected: true, card: null,
    querySelector() { return this.card; },
    replaceChildren(card) {
      if (this.card) this.card.isConnected = false;
      this.card = card || null;
      if (card) card.isConnected = this.connected;
    },
  };
  const document = {
    visibilityState: "visible",
    createElement() {
      const buttons = new Map();
      return { isConnected: false, setAttribute() {},
        querySelector(key) { if (!buttons.has(key)) buttons.set(key, {}); return buttons.get(key); } };
    },
    addEventListener() {}, removeEventListener() {},
  };
  const source = read("../app/email-verification-ui.js");
  const controller = source.slice(source.indexOf("export function mountEmailVerificationReminder")).replace("export ", "");
  const mount = runInNewContext(`let sessionShownFor="",statusListener=null; ${controller}; mountEmailVerificationReminder`, {
    api: { cloudAccountId: () => "member", authMode: () => "cloud",
      cloudAccountStateLoaded: () => true, cloudSessionAccount: () => account },
    document, Date, EMAIL_REMINDER_ID, shouldShowEmailReminder,
    emailNeedsVerification: () => account.emailVerified === false,
    readHelpState: () => state,
    persist(owner, event) {
      events.push({ event, connected: slot.card?.isConnected === true });
      if (event === "shown") state.items[EMAIL_REMINDER_ID] = { lastShownAt: Date.now() };
      if (event === "snooze") state.items[EMAIL_REMINDER_ID].snoozedUntil = Date.now() + 7 * 86400000;
    },
    openEmailVerificationSheet() {}, refreshEmailVerificationStatus() {},
  });
  return { slot, account, state, events, mount: options => mount({ querySelector: () => slot }, options) };
}

test("eligible card mounts before shown is recorded and keeps its node on refresh", () => {
  const h = harness();
  h.mount();
  const original = h.slot.card;
  assert.ok(original);
  assert.deepEqual(h.events, [{ event: "shown", connected: true }]);
  h.mount();
  assert.equal(h.slot.card, original);
  assert.equal(h.events.length, 1);
});

test("disconnected card never consumes the weekly reminder", () => {
  const h = harness();
  h.slot.connected = false;
  h.mount();
  assert.equal(h.events.length, 0);
});

test("Not now removes card, persists snooze and does not send mail or reappear", () => {
  const h = harness();
  h.mount();
  h.slot.card.querySelector("[data-ev-snooze]").onclick();
  assert.equal(h.slot.card, null);
  assert.equal(h.events.at(-1).event, "snooze");
  h.mount();
  assert.equal(h.slot.card, null);
});

test("unknown verification, pause and busy screens never get a reminder", () => {
  for (const kind of ["unknown", "pause", "busy"]) {
    const h = harness();
    if (kind === "unknown") h.account.emailVerified = null;
    if (kind === "pause") h.state.paused = true;
    h.mount({ isBusy: () => kind === "busy" });
    assert.equal(h.slot.card, null);
    assert.equal(h.events.length, 0);
  }
});

test("verified or paused state removes an existing managed card", () => {
  for (const kind of ["verified", "pause"]) {
    const h = harness();
    h.mount();
    if (kind === "verified") h.account.emailVerified = true;
    else h.state.paused = true;
    h.mount();
    assert.equal(h.slot.card, null);
  }
});

test("stable Home explicitly preserves managed slot children between the third and fourth posts", () => {
  const keyed = read("../app/keyed-ui.js"), app = read("../app/app.js");
  assert.match(keyed, /hasAttribute\("data-managed-slot"\)\) return;/);
  assert.match(app, /index === 2 && posts\.length >= 4/);
  assert.match(app, /id="ev-feed-slot" data-ev-slot data-managed-slot/);
});
