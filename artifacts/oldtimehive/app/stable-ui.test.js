import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { installStableDataRefresh } from "./stable-ui.js";
import { unreadInboxCount } from "./inbox-unread.js";
import { isPlainEmojiMessage } from "./chat-emoji.js";

test("data refreshes coalesce and never replace a focused input or pressed control", () => {
  const doc = new EventTarget(), win = new EventTarget();
  let callback, observer, renders = 0, typing = false;
  Object.assign(doc, { body: {}, hidden: false, activeElement: { matches: () => typing } });
  Object.assign(win, {
    requestAnimationFrame: fn => { callback = fn; return 1; },
    cancelAnimationFrame: () => {},
    MutationObserver: class { constructor(fn) { observer = fn; } observe() {} disconnect() {} },
  });
  const dispose = installStableDataRefresh({ document: doc, window: win, render: () => renders++ });
  const tick = () => { const fn = callback; callback = null; fn?.(); };
  win.dispatchEvent(new Event("oldtime-data")); win.dispatchEvent(new Event("oldtime-data")); tick();
  assert.equal(renders, 1);
  typing = true;
  win.dispatchEvent(new Event("oldtime-data")); tick();
  assert.equal(renders, 1);
  typing = false; doc.dispatchEvent(new Event("focusout")); tick();
  assert.equal(renders, 2);
  doc.dispatchEvent(new Event("pointerdown")); win.dispatchEvent(new Event("oldtime-data")); tick();
  assert.equal(renders, 2);
  doc.dispatchEvent(new Event("pointerup")); tick();
  assert.equal(renders, 3);
  dispose(); observer(); win.dispatchEvent(new Event("oldtime-data")); tick();
  assert.equal(renders, 3);
});

test("unread badge respects ownership, read-through, hidden, archived and marked-unread messages", () => {
  const message = { author: "other", created: 300, status: "sent" };
  const conversation = { members: ["me", "other"], cloudState: { readThrough: 200 }, messages: [
    message, { ...message, created: 100 }, { ...message, read: true }, { ...message, hiddenFor: ["me"] },
    { ...message, author: "me" },
  ] };
  assert.equal(unreadInboxCount([conversation], { id: "me" }), 1);
  assert.equal(unreadInboxCount([{ ...conversation, legacyArchive: true }], { id: "me" }), 0);
  assert.equal(unreadInboxCount([{ ...conversation, locked: true }], { id: "me" }), 0);
  assert.equal(unreadInboxCount([{ ...conversation, cloudState: { markedUnread: true }, messages: [] }], { id: "me" }), 1);
  assert.equal(unreadInboxCount([conversation], { id: "stranger" }), 0);
});

test("emoji-only messages are plain; greetings and numbers stay normal bubbles", () => {
  for (const body of ["😀", "❤️", "🇭🇹", "👩🏽‍💻", "1️⃣", "😀 ❤️"]) assert.equal(isPlainEmojiMessage({ kind: "text", body }), true, body);
  for (const body of ["👋", "👋🏽", "hello", "123", "😀 hello", ""]) assert.equal(isPlainEmojiMessage({ kind: "text", body }), false, body);
});

test("Community suggestions use photos, profile actions and stable dimensions", () => {
  const source = readFileSync(new URL("./community-feeds.js", import.meta.url), "utf8");
  assert.match(source, /person\.avatar\|\|person\.avatarReference/);
  assert.match(source, /width="56" height="56"/);
  assert.match(source, />View profile<\/button>/);
  assert.doesNotMatch(source, /name\.slice\(0,1\)/);
});
