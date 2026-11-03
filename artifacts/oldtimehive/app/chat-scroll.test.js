import test from "node:test";
import assert from "node:assert/strict";
import { shouldScrollChatToBottom } from "./chat-scroll.js";

test("a new thread opens at the latest message", () => {
  assert.equal(shouldScrollChatToBottom(), true);
});

test("rerendering a thread follows new content only when already at the bottom", () => {
  assert.equal(shouldScrollChatToBottom({ sameThreadVisible: true, wasAtBottom: true }), true);
  assert.equal(shouldScrollChatToBottom({ sameThreadVisible: true, wasAtBottom: false }), false);
});

test("returning to a saved thread position does not force the latest message", () => {
  assert.equal(shouldScrollChatToBottom({ scrollRestored: true }), false);
});

test("sending a message explicitly follows the latest message", () => {
  assert.equal(shouldScrollChatToBottom({ requested: true, sameThreadVisible: true }), true);
});
