import assert from "node:assert/strict";
import test from "node:test";
import { renderMentionText } from "./mention-autocomplete.js";

test("mention rendering links handles while escaping authored content", () => {
  const rendered = renderMentionText("Hello @oldtime, email test@example.com <script>alert(1)</script>");
  assert.match(rendered, /data-mention-handle="oldtime">@oldtime<\/button>/);
  assert.match(rendered, /test@example\.com/);
  assert.doesNotMatch(rendered, /data-mention-handle="example"/);
  assert.match(rendered, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("community text can render noninteractive inline mention markers", () => {
  const rendered = renderMentionText("@oldtime", { tag: "span" });
  assert.match(rendered, /^<span class="mention-link" data-mention-handle="oldtime">@oldtime<\/span>$/);
  assert.doesNotMatch(rendered, /<button/);
});
