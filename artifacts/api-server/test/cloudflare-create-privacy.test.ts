import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { CreatePostBody, UpdatePostBody } from "@workspace/api-zod";
import { visiblePost, type Database } from "../src/cloudflare/runtime";
import { mentionRecipients } from "../src/cloudflare/social";

// Isolated in-memory SQL regression checks; no accounts or media are written
// to a workspace database or the live Cloudflare app.
function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY, username TEXT, is_private INTEGER,is_virtual INTEGER DEFAULT 0);
    CREATE TABLE engine_preferences(user_id TEXT PRIMARY KEY,show_virtual_content INTEGER DEFAULT 1);
    CREATE TABLE account_state(user_id TEXT, data TEXT);
    CREATE TABLE posts(id TEXT PRIMARY KEY, author_id TEXT, visibility TEXT, archived_at INTEGER);
    CREATE TABLE user_follows(follower_id TEXT, followed_id TEXT);
    CREATE TABLE friendships(member_low_id TEXT, member_high_id TEXT);
    CREATE TABLE close_friend_members(owner_id TEXT, member_id TEXT);
    CREATE TABLE account_blocks(owner_id TEXT, blocked_id TEXT);
    CREATE TABLE post_media_assets(post_id TEXT, media_id TEXT);
    INSERT INTO users(id,username,is_private) VALUES
      ('owner','owner',0),('follower','follower',0),('friend','friend',0),
      ('outsider','outsider',0),('close','closemember',0);
    INSERT INTO posts(id,author_id,visibility) VALUES ('post','owner','connections');
    INSERT INTO post_media_assets VALUES ('post','known-media-id');
    INSERT INTO user_follows VALUES ('follower','owner'),('close','owner');
    INSERT INTO friendships VALUES ('owner','friend');
    INSERT INTO close_friend_members VALUES ('owner','close');
  `);
  const db = {
    prepare(query: string) {
      let values: SQLInputValue[] = [];
      return {
        bind(...args: SQLInputValue[]) { values = args; return this; },
        async first() { return sql.prepare(query).get(...values) ?? null; },
        async all() { return { results: sql.prepare(query).all(...values) }; },
      };
    },
  } as unknown as Database;
  const visible = (viewer: string, media = false) => !!sql.prepare(`
    WITH viewer AS (SELECT ? AS id)
    SELECT p.id FROM posts p JOIN users u ON u.id=p.author_id
    ${media ? "JOIN post_media_assets pm ON pm.post_id=p.id" : ""}
    WHERE ${visiblePost} ${media ? "AND pm.media_id='known-media-id'" : ""}
  `).get(viewer);
  return { sql, db, visible };
}

test("post input and edits accept the restricted connections audience", () => {
  assert.equal(CreatePostBody.safeParse({ text: "A real post", visibility: "connections" }).success, true);
  assert.equal(UpdatePostBody.safeParse({ text: "Edited", place: null, visibility: "connections" }).success, true);
  assert.equal(CreatePostBody.safeParse({ text: "Invalid", visibility: "everyone-including-strangers" }).success, false);
});

test("connections posts and known media IDs are visible only to owner, friends, and followers", t => {
  const { sql, visible } = fixture();
  t.after(() => sql.close());
  for (const media of [false, true]) {
    for (const viewer of ["owner", "follower", "friend", "close"]) assert.equal(visible(viewer, media), true, viewer);
    assert.equal(visible("outsider", media), false);
    assert.equal(visible("", media), false);
  }
  sql.exec("UPDATE users SET is_private=1 WHERE id='owner'");
  assert.equal(visible("friend"), true, "An existing friend is an explicitly selected connection");
  assert.equal(visible("follower"), true);
  assert.equal(visible("outsider", true), false);
  sql.exec("INSERT INTO account_blocks VALUES ('friend','owner')");
  assert.equal(visible("friend"), false, "Either direction of block revokes access");
  assert.equal(visible("friend", true), false);
});

test("public account privacy and Close Friends remain separate from connections", t => {
  const { sql, visible } = fixture();
  t.after(() => sql.close());
  sql.exec("UPDATE posts SET visibility='public'");
  assert.equal(visible("outsider"), true);
  sql.exec("UPDATE users SET is_private=1 WHERE id='owner'");
  assert.equal(visible("outsider"), false);
  assert.equal(visible("follower"), true);
  sql.exec("UPDATE posts SET visibility='close-friends'");
  assert.equal(visible("close"), true);
  assert.equal(visible("follower"), false);
  assert.equal(visible("friend"), false);
});

test("restricted post mentions cannot notify outsiders with inaccessible content", async t => {
  const { sql, db } = fixture();
  t.after(() => sql.close());
  const members = await mentionRecipients(db, "owner", "@friend @follower", "connections");
  assert.equal(members.length, 2);
  await assert.rejects(mentionRecipients(db, "owner", "@outsider", "connections"), /cannot view/);
  await assert.rejects(mentionRecipients(db, "owner", "@friend", "followers"), /cannot view/);
  await assert.rejects(mentionRecipients(db, "owner", "@follower", "friends"), /cannot view/);
  sql.exec("UPDATE users SET is_private=1 WHERE id='owner'");
  await assert.rejects(mentionRecipients(db, "owner", "@friend", "public"), /cannot view/);
  assert.equal((await mentionRecipients(db, "owner", "@friend", "connections")).length, 1);
  sql.exec("INSERT INTO account_blocks VALUES ('owner','friend')");
  await assert.rejects(mentionRecipients(db, "owner", "@friend", "connections"), /settings or your account relationship/);
});
