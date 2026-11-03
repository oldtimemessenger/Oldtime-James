import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Community keeps global Chat, its compact composer, and post sharing separate", () => {
  const source = read("app.js");
  for (const view of ["updates", "communities", "search", "chat", "profile"]) {
    assert.ok(source.includes(`data-tab="${view}"`));
  }
  assert.match(source, /<button class="icon" data-tab="search" aria-label="Search"/);
  assert.match(source, /id="community-note-open"/, "Community has a focused post composer");
  assert.match(source, /\$\("#community-note-open"\)\?\.addEventListener\("click", openCommunityNoteComposer\)/);
  assert.doesNotMatch(source, /id="community-note-gif"|data-testid=".*gif/i);
  assert.doesNotMatch(source, /community-more-open|data-blast-tool|blast-tools-title|blast-event-title/);
  assert.match(source, /data-repost="\$\{esc\(post\.id\)\}".*fmt\(repostCount\)/);
  assert.match(source, /data-comment="\$\{esc\(post\.id\)\}".*fmt\(commentCount\)/);
  assert.match(source, /data-save="\$\{esc\(post\.id\)\}"[^>]*aria-pressed="\$\{saved\}"/);
  assert.match(source, /class="nav-create-button" id="create-open"/);
  assert.doesNotMatch(source, /button-nav-create-post/);
  const nav = source.match(/<nav class="nav \$[\s\S]*?<\/nav>/)?.[0] || "";
  assert.deepEqual([...nav.matchAll(/data-tab="([^"]+)"/g)].map(match => match[1]), [
    "updates", "communities", "chat", "profile"
  ]);
  assert.doesNotMatch(nav, /data-tab="search"/);
  assert.match(source, /<button class="icon" data-tab="search" aria-label="Search"/);
  for (const route of ["profile", "notes", "settings"]) {
    assert.ok(source.includes(`data-drawer-route="${route}"`));
  }
  for (const excluded of ["communities", "chat", "live", "sports"]) {
    assert.ok(!source.includes(`data-drawer-route="${excluded}"`));
  }
});

test("the central Create entry point opens the post camera immediately", () => {
  const source = read("app.js");
  const editor = read("creative-editor-view.js");
  assert.match(source, /class="nav-create-button" id="create-open"/);
  assert.match(source, /data-testid="button-nav-create"/);
  assert.doesNotMatch(source, /data-create-flow=|create-flow-picker/);
  assert.match(source, /function openHomeCreate\(\)\s*\{\s*return openUniversalCreation\(\{ destination: "post", startCamera: true \}\);/);
  assert.match(editor, /data-ce-share-destination="feed"/);
  assert.match(editor, /data-ce-share-destination="story"/);
  assert.match(editor, /data-ce-share-destination="close-friends"/);
  assert.match(source, /editorVersion:"v2"/);
  assert.match(source, /function openCommunityNoteComposer\(\)/);
  assert.doesNotMatch(source, /openCreationHub|creation-hub/);
});

test("Messages start new online chats separately from read-only archives", () => {
  const chat = read("chat.js");
  const store = read("store.js");
  const sendMessage = store.slice(store.indexOf("async sendCloudChatMessage"), store.indexOf("async loadCloudChatPreferences"));
  assert.match(chat, /find\(x => !x\.legacyArchive/);
  assert.match(chat, /api\.searchCloudUsers\(query\)/);
  assert.match(chat, /data-pick=/);
  assert.match(chat, /putLocalMedia/);
  assert.doesNotMatch(chat, /fileToData/);
  assert.doesNotMatch(sendMessage, /method:\s*"PUT"/);
  assert.match(store, /\.filter\(room => room\.messages\.length > 0 \|\| room\.draft\.trim\(\)\.length > 0\)/);
});

test("new message opens a one-to-one inbox directly and group picks can be removed", () => {
  const chat = read("chat.js");
  assert.match(chat, /const conversationId = ensureConvo\(\[personId\]\)/);
  assert.match(chat, /ctx\.setChat\(conversationId\)/);
  assert.match(chat, /id="chat-compose-selected"/);
  assert.match(chat, /data-remove-pick=/);
  assert.match(chat, /id="chat-compose-action"/);
  assert.match(chat, /Create group/);
  assert.doesNotMatch(chat, /"Start chat"/);
});

test("Profile exposes Settings directly and migrates legacy data in the background", () => {
  const source = read("app.js");
  assert.match(source, /data-profile-settings/);
  assert.doesNotMatch(source, /data-profile-app-menu/);
  assert.doesNotMatch(source, /data-transfer|Transfer old data/);
  assert.match(source, /migrateLegacyAccountDataInBackground/);
  assert.match(source, /api\.migrateCloudTextPosts\(\{ retry: true \}\)/);
  assert.match(source, /api\.migrateCloudStories\(\{ retry: true \}\)/);
  assert.match(source, /api\.migrateLegacyChatArchives\(\{ retry: true \}\)/);
  assert.doesNotMatch(source, /migrateLegacyCreativeDrafts/,
    "retired Create drafts must not be re-imported after the confirmed cleanup");
});
