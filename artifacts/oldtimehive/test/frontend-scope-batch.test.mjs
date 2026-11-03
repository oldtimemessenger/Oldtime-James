import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attachmentKind, communityMediaItems, postHasVideo } from "../app/community-post-media.js";
import { normalizeListVisibility, listVisibilityOf, canSeeProfileList, saveListVisibility, fetchListVisibility } from "../app/profile-list-visibility.js";
import { shouldShowEmailReminder, applyEmailReminderEvent, accountReminderOffset, EMAIL_REMINDER_GRACE_MS, EMAIL_REMINDER_GAP_MS } from "../app/email-verification-reminder.js";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("selected attachment kind comes from its own MIME metadata", () => {
  assert.equal(attachmentKind("video/mp4; codecs=avc1"), "video");
  assert.equal(attachmentKind(" VIDEO/QUICKTIME"), "video");
  assert.equal(attachmentKind("video"), "video");
  assert.equal(attachmentKind("image/jpeg"), "photo");
  assert.equal(attachmentKind(""), "");
  const post = { kind: "photo", mediaTypes: ["image/jpeg", "video/mp4", "image/png", "image/webp", "video/webm", "image/heic"], mediaPosters: ["", "poster-2"] };
  const refs = ["https://cdn/a1b2c3", "https://cdn/0f9e-uuid", "x", "y", "z", "w"];
  const items = communityMediaItems(post, refs);
  assert.equal(items[1].video, true, "video 2 of 6 is a video even though post.kind is photo and the URL has no extension");
  assert.equal(items[1].poster, "poster-2");
  assert.equal(items[0].video, false);
  assert.equal(items[4].video, true);
  assert.equal(postHasVideo(post), true);
});

test("post viewer renders a playable video for a selected video attachment", () => {
  const app = read("../app/app.js");
  assert.match(app, /const selectedItem = communityMediaItems\(p, postMedia\)\[selectedSlide\]/);
  assert.match(app, /selectedIsVideo\s*\n?\s*\? `<video class="fullimg carousel-video"/);
  assert.match(app, /renderKind === "video" && !rawCarousel/);
});

test("other people's list defaults: followers hidden, following visible; owner sees both", () => {
  assert.deepEqual(normalizeListVisibility(undefined), { followers: false, following: true });
  assert.deepEqual(listVisibilityOf({ profile: { profileListVisibility: { followers: true, following: false } } }), { followers: true, following: false });
  assert.equal(canSeeProfileList("followers", {}), false);
  assert.equal(canSeeProfileList("following", {}), true);
  assert.equal(canSeeProfileList("followers", { isOwner: true, visibility: { followers: false, following: false } }), true);
});

test("list visibility PUT always sends both flags", async () => {
  const calls = [];
  const fake = async (path, options = {}) => { calls.push([path, options]); return options.body || { followers: true }; };
  assert.deepEqual(await fetchListVisibility(fake), { followers: true, following: true });
  await saveListVisibility({ followers: true }, fake);
  assert.equal(calls[1][0], "/api/account/profile-list-visibility");
  assert.equal(calls[1][1].method, "PUT");
  assert.deepEqual(calls[1][1].body, { followers: true, following: true });
});

test("email reminder policy: unverified only, 24h grace, max once per 7 days, snooze/never/paused, deterministic", () => {
  const accountId = "acct-1", created = 1_000_000_000_000;
  const after = created + EMAIL_REMINDER_GRACE_MS + accountReminderOffset(accountId) + 1;
  const state = { paused: false, items: {} };
  assert.equal(shouldShowEmailReminder({ accountId, verified: false, accountJoinedAt: created, state, now: created + 1000 }), false);
  assert.equal(shouldShowEmailReminder({ accountId, verified: false, accountJoinedAt: created, state, now: after }), true);
  assert.equal(shouldShowEmailReminder({ accountId, verified: false, accountJoinedAt: created, state, now: after }), true, "same answer on every render");
  assert.equal(shouldShowEmailReminder({ accountId, verified: true, accountJoinedAt: created, state, now: after }), false);
  assert.equal(shouldShowEmailReminder({ accountId, verified: undefined, accountJoinedAt: created, state, now: after }), false);
  assert.equal(shouldShowEmailReminder({ accountId, verified: false, accountJoinedAt: created, state, now: after, busy: true }), false);
  assert.equal(shouldShowEmailReminder({ accountId, verified: false, accountJoinedAt: created, state: { ...state, paused: true }, now: after }), false);
  const shown = applyEmailReminderEvent(state, "shown", after);
  assert.equal(shouldShowEmailReminder({ accountId, verified: false, accountJoinedAt: created, state: shown, now: after + EMAIL_REMINDER_GAP_MS - 1 }), false);
  assert.equal(shouldShowEmailReminder({ accountId, verified: false, accountJoinedAt: created, state: shown, now: after + EMAIL_REMINDER_GAP_MS }), true);
  const snoozed = applyEmailReminderEvent(state, "snooze", after);
  assert.equal(shouldShowEmailReminder({ accountId, verified: false, accountJoinedAt: created, state: snoozed, now: after + 1 }), false);
  const never = applyEmailReminderEvent(state, "never", after);
  assert.equal(shouldShowEmailReminder({ accountId, verified: false, accountJoinedAt: created, state: never, now: after * 2 }), false);
  assert.equal(accountReminderOffset(accountId), accountReminderOffset(accountId));
  for (const bad of [undefined, 0, "2024-01-01", 1.5, after + 10])
    assert.equal(shouldShowEmailReminder({ accountId, verified: false, accountJoinedAt: bad, state, now: after }), false, `invalid joinedAt ${bad}`);
  assert.equal(applyEmailReminderEvent(state, "seen", after).items["verify-email"].firstSeenAt, undefined, "no first-check reset");
  const ui = read("../app/email-verification-ui.js");
  assert.equal((ui.match(/method: "POST"/g) || []).length, 1, "only the explicit Send button posts");
  assert.match(ui, /accountJoinedAt: account\.joinedAt/);
  assert.match(ui, /querySelector\("\[data-ev-slot\]"\)/, "card mounts only into an inline feed slot");
  assert.doesNotMatch(read("../app/email-verification.css"), /top:calc\(env\(safe-area-inset-top,0px\) \+ 96px\)/);
  const app = read("../app/app.js");
  assert.match(app, /index === 2 && posts\.length >= 4 \? `<div class="ev-feed-slot" id="ev-feed-slot" data-ev-slot data-managed-slot><\/div>`/);
  assert.match(app, /data-ev-editor-open/);
  assert.doesNotMatch(app, /This email isn’t confirmed yet/, "no standing explanation under the email field");
  assert.match(app, /if \(open && fresh && fresh !== open && open\.classList\.contains\("on"\)\) fresh\.replaceWith\(open\)/, "list sheet survives follow re-render");
  assert.doesNotMatch(ui, /Blue Badge/i);
});

test("creative editor sound is manual-only: no automatic trending suggestion", () => {
  const editor = read("../app/creative-editor.js"), view = read("../app/creative-create-view.js"), ws = read("../app/creative-studio-workspace.js");
  for (const source of [editor, view, ws]) assert.doesNotMatch(source, /sound-suggestion|loadSoundSuggestion|suggestedSound/);
  assert.match(editor, /q\("sound-chip"\)\.onclick=/, "manual sound picker remains");
});

test("profile list sheet: server endpoint, privacy/blocked messaging, bounded paging", async () => {
  const { profileListErrorMessage, PROFILE_LIST_PAGE, PROFILE_LIST_MAX } = await import("../app/profile-list-sheet.js").catch(() => ({}));
  const src = read("../app/profile-list-sheet.js"), store = read("../app/store.js"), app = read("../app/app.js");
  assert.match(store, /\/api\/profiles\/\$\{encodeURIComponent\(username\)\}\/\$\{kind\}\?limit=/);
  assert.match(src, /error\?\.status === 403\) return hiddenListMessage/);
  assert.match(src, /error\?\.status === 404\) return "This list isn’t available\."/);
  assert.match(src, /PROFILE_LIST_MAX = 300/);
  assert.match(app, /\.profile-stats \[data-profile-list\]"\)\.forEach\(button => button\.onclick = \(\) => openProfileListSheet/);
  assert.match(app, /const listHidden = !mine && !canSeeProfileList\(kind/);
  assert.match(app, /locked \|\| listHidden \? \[\]/, "preview faces respect hidden flags; owner (mine) always sees");
  void profileListErrorMessage; void PROFILE_LIST_PAGE; void PROFILE_LIST_MAX;
});
