import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL(name, import.meta.url), "utf8");
const chat = read("chat.js");
const styles = read("styles.css");
const icons = read("icons.js");
const inbox = chat.slice(chat.indexOf('<section class="screen on light chat-list-screen"'), chat.indexOf('let listFilter = "all"'));
const header = inbox.slice(inbox.indexOf('<div class="chat-list-topline">'), inbox.indexOf('<div class="chat-list-body">'));

test("inbox settings gear replaces the three-dot header control", () => {
  assert.match(header, /id="chat-more"[^>]*aria-label="Chat Settings"[^>]*>\$\{ic\.gear\}/);
  assert.doesNotMatch(inbox, /chat-filter-control|chat-filter-label|>All</);
  assert.match(inbox, /data-more-filter="all"[^>]*>.*Every chat/);
});

test("message bubbles use black and pearl without changing the app-wide brand", () => {
  const unboxed = read("unboxed-interface.css");
  assert.match(unboxed, /#app \.conversation-screen \.bubble-msg\.mine\s*\{[^}]*background:\s*#17191c!important[^}]*color:\s*#f8f7f3!important/);
  assert.match(unboxed, /#app \.conversation-screen \.bubble-msg\.theirs\s*\{[^}]*background:\s*#f6f4ef!important[^}]*color:\s*#17191c!important/);
});

test("inbox keeps folders in consolidated Chat Settings", () => {
  assert.match(header, /class="chat-search-trigger" id="toggle-chat-search"[^>]*aria-label="Search messages"[^>]*>\$\{ic\.search\}<\/button>/);
  assert.match(chat, /moreButton\.onclick = \(\) => showInboxSettings\(ctx\)/);
  assert.match(read("chat-settings.js"), /Allow direct messages from/);
  assert.match(read("chat-settings.js"), /Allow group chat invites from/);
  assert.match(read("chat-settings.js"), /Folders/);
  assert.doesNotMatch(header, /id="saved"|id="chat-filter-open"/);
  // Creation belongs beside Search, never in the Stories/Notes rail.
  assert.match(header, /id="newchat"/);
  assert.equal((header.match(/<button type="button" class="chat-(?:search-trigger|head-icon)"/g) || []).length, 3);
  assert.doesNotMatch(inbox, /chat-inbox-tabs|chat-inbox-tab/);
  assert.match(inbox, /\["primary","Primary"\]/);
  assert.match(inbox, /\["requests","Requests"\]/);
  assert.match(inbox, /\["general","General"\]/);
  assert.match(inbox, /id="more-saved"/);
  assert.match(inbox, /<h2>Filters<\/h2>/);
  assert.match(inbox, /id="more-folders" aria-expanded="true"/);
  assert.match(inbox, /id="chat-folder-options">/);
  assert.match(icons, /sendUp: '<path d="M12 19V5m-7 7 7-7 7 7"/);
});

test("selected Message/Group controls use the reference pale-blue row and radio", () => {
  const unboxed = read("unboxed-interface.css");
  assert.match(unboxed, /#app \.chat-compose-panel \.chat-compose-mode\[aria-pressed="true"\] \{[^}]*color:#17191c!important/);
  assert.match(unboxed, /#app \.chat-compose-panel \.chat-compose-mode\[aria-pressed="true"\] \{[^}]*background:#e8f1ff!important/);
  assert.match(styles, /\.chat-compose-mode \{[^}]*border-radius:999px[^}]*font-size:14px[^}]*font-weight:500/);
  assert.match(styles, /\.chat-compose-mode\[aria-pressed="true"\]::after \{[^}]*background:var\(--color-primary\)/);
  assert.match(chat, /data-compose-kind="message"[^>]*>[\s\S]*?Message<\/(?:span|button)>/);
  assert.match(icons, /edit:\s*'<path d=/);
  assert.match(icons, /stroke="currentColor"/);
});

test("outside taps close inbox search and clear its filter", () => {
  assert.match(chat, /document\.addEventListener\("click", searchOutside\)/);
  assert.match(chat, /!e\.target\.closest\?\.\("#chat-search-panel"\).*closeSearch\(\)/);
  assert.match(chat, /searchInput\.value = ""/);
});

test("chat refresh failures only notify on the active signed-in message screen", () => {
  const refresh = chat.slice(chat.indexOf("function refreshActiveChat"), chat.indexOf("subscribeChatUpdates(refreshActiveChat)"));
  assert.match(refresh, /view\.owner !== api\.cloudAccountId\(\)/);
  assert.match(refresh, /activeChatView === view/);
  assert.match(refresh, /current\.owner === api\.cloudAccountId\(\)/);
  assert.match(refresh, /Messages could not refresh\. Check your connection and reopen the chat\./);
  assert.doesNotMatch(refresh, /error\??\.message/);
});

test("selected inbox filters and Saved card use flat colors without glow", () => {
  const unboxed = read("unboxed-interface.css");
  assert.match(unboxed, /chat-option\[aria-checked=true\],\.chat-folder-options button\.active\)[\s\S]*background:#e8f1ff!important/);
  assert.match(unboxed, /chat-option\[aria-checked=true\] \.chat-option-radio::after[\s\S]*background:#fff/);
  assert.match(unboxed, /#app \.chat-option\[aria-checked=true\]:focus-visible \{[^}]*outline:0/);
  assert.doesNotMatch(unboxed, /chat-option\[aria-checked=true\][^{]*\{[^}]*box-shadow:[^;]*rgba/);
  assert.match(styles, /\.chat-option\[aria-checked="true"\] \{[^}]*background:#e8f1ff/);
  assert.match(styles, /\.chat-option-radio \{ width:26px; height:26px/);
  assert.match(styles, /\.chat-organize-card \{[^}]*background:#fff[^}]*box-shadow:none/);
  assert.match(styles, /\.chat-organize-icon \{[^}]*background:#fff[^}]*box-shadow:none/);
  assert.match(styles, /\.chat-organize-card #more-saved \{[^}]*box-shadow:none/);
  assert.doesNotMatch(styles, /\.chat-organize-card \{[^}]*linear-gradient/);
});

test("empty inbox offers a working, compact New chat action", () => {
  assert.match(chat, /Say hi to someone/);
  assert.match(chat, /id="empty-newchat"[^>]*><span>New message<\/span>/);
  assert.match(chat, /emptyNewChat\.onclick = \(\) => pick\(ctx, false\)/);
  assert.match(icons, /messagePlus: '<path d=/);
});

test("inbox and discovery search use a borderless rounded search capsule", () => {
  const unboxed = read("unboxed-interface.css");
  assert.match(unboxed, /#app \.chat-search-wrap,[\s\S]*border-radius:999px!important/);
  assert.match(unboxed, /#app \.chatsearch,[\s\S]*background:transparent!important/);
  assert.match(unboxed, /#app \.chat-search-wrap,\s*#app \.discovery-search-wrap\s*\{[^}]*background:#f1f2f4!important/);
  assert.match(unboxed, /#app \.chat-search-trigger[\s\S]*border-radius:999px/);
});

test("empty chats stay quiet and the composer expands for full text", () => {
  assert.match(chat, /class="chat-empty-intro"/);
  assert.match(chat, /class="chat-empty-avatar"/);
  assert.match(chat, /Say hi/);
  assert.match(chat, /<textarea id="msg" rows="1"/);
  assert.match(chat, /e\.currentTarget\.form\?\.requestSubmit\(\)/);
  assert.match(styles, /\.chat-composer textarea \{[^}]*max-height:112px/);
  assert.match(styles, /\.conversation-screen \.message-body \{[^}]*white-space:pre-wrap/);
  assert.match(styles, /\.chat-option-icon \{[^}]*border-radius:0[^}]*background:transparent/);
});

test("message bubbles size to their content and keep sender and receiver alignment", () => {
  assert.match(styles, /\.conversation-screen \.bubble-msg \{[^}]*height:auto[^}]*min-height:0[^}]*flex:0 0 auto/);
  assert.match(styles, /\.conversation-screen \.bubble-msg\.mine \{[^}]*align-self:flex-end/);
  assert.match(styles, /\.conversation-screen \.bubble-msg\.theirs \{[^}]*align-self:flex-start/);
  assert.match(styles, /\.conversation-screen \.message-row \{[^}]*background:transparent/);
  assert.match(chat, /<div class="message-body">\$\{body\(m, c\.legacyArchive\)\}<\/div>/);
  assert.match(chat, /<div \$\{messageRow\}><div class="bubble-msg/);
  assert.match(chat, /messageDayLabel\(m\.created\)/);
  assert.match(chat, /const time = cluster\.endsCluster \? `<span class="message-time">/);
  assert.match(chat, /const metadata = flags \|\| footer \?/);
  assert.match(chat, /messageDetails = \[messageDateTime\(m\.created\), m\.edited \? "Edited" : ""\]/);
  assert.match(chat, /<div \$\{messageRow\}><div class="bubble-msg[\s\S]*\$\{metadata\}<\/div>`;/);
  assert.match(chat, /String\(m\.body \|\| ""\)\.replace\(\/\\r\\n\?\/g, "\\n"\)\.trim\(\)/);
});
