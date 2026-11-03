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

test("mention rendering supports multiple handles without matching inside usernames or emails", () => {
  const rendered = renderMentionText("@first_user and (@second-user) plus user_name@example.com");
  assert.match(rendered, /data-mention-handle="first_user"/);
  assert.match(rendered, /data-mention-handle="second"/);
  assert.doesNotMatch(rendered, /data-mention-handle="example"/);
  assert.match(rendered, /user_name@example\.com/);
});

test("mention rendering safely escapes handles and preserves surrounding text", () => {
  const rendered = renderMentionText("Before @valid_name after & <b>unsafe</b>");
  assert.match(rendered, /^Before <button type="button" class="mention-link" data-mention-handle="valid_name">@valid_name<\/button> after &amp; &lt;b&gt;unsafe&lt;\/b&gt;$/);
});
