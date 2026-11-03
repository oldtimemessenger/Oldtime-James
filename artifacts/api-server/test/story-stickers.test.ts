import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { storyRequest } from "../src/cloudflare/stories";
import { notificationsRequest } from "../src/cloudflare/notifications";
import { stickersForStories } from "../src/cloudflare/story-stickers";
import type { Database, Statement } from "../src/cloudflare/runtime";
import { reviewMediaBucket, safeReviewAi } from "./content-moderation-fixtures";

function fixture(t: any) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  const dir = new URL("../migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, dir), "utf8"));
  t.after(() => sqlite.close());
  function prepare(sql: string): Statement {
    let values: unknown[] = [];
    return { bind(...v: unknown[]) { values = v; return this; },
      async first<T>() { return (sqlite.prepare(sql).get(...values as any[]) || null) as T | null; },
      async all<T>() { return { success: true, results: sqlite.prepare(sql).all(...values as any[]) as T[] }; },
      async run() {
        if (/^\s*(SELECT|WITH)\b/i.test(sql)) return { success: true, results: sqlite.prepare(sql).all(...values as any[]) };
        const result = sqlite.prepare(sql).run(...values as any[]); return { success: true, meta: { changes: Number(result.changes) } };
      } };
  }
  const db: Database = { prepare, async batch(writes) {
    sqlite.exec("BEGIN");
    try { const result = []; for (const write of writes) result.push(await write.run()); sqlite.exec("COMMIT"); return result; }
    catch (e) { sqlite.exec("ROLLBACK"); throw e; }
  } };
  const users = Array.from({ length: 3 }, (_, i) => {
    const id = randomUUID();
    sqlite.prepare(`INSERT INTO users(id,email,username,display_name,password_salt,password_hash,created_at,privacy_initialized)
      VALUES(?,?,?,?,?,?,?,1)`).run(id, `sticker${i}@example.test`, `sticker_${i}`, `Member ${i}`, "test", "test", Date.now());
    return id;
  });
  const request = (actor: string, path: string, method = "GET", input?: unknown) => storyRequest(new Request(`https://test/api${path}`, {
    method, headers: { "content-type": "application/json" }, ...(input ? { body: JSON.stringify(input) } : {}),
  }), db, reviewMediaBucket, actor, path.split("?")[0], safeReviewAi);
  const create = async (actor: string, stickers: unknown[], extra = {}) =>
    (await (await request(actor, "/stories", "POST", { text: "Status", visibility: "public", stickers, ...extra })).json()).story;
  return { sqlite, db, users, request, create };
}

test("feed metadata batches stay below D1 parameter limits", async () => {
  const pages: number[] = [];
  const db = { prepare() { return { bind(...values: unknown[]) {
    pages.push(values.length);
    return { async all() { return { results: [] }; } };
  } }; } } as unknown as Database;
  await stickersForStories(db, Array.from({ length: 201 }, () => randomUUID()));
  assert.deepEqual(pages, [80, 80, 41]);
});

test("Status mentions reuse tag permissions and notifications respect current Story visibility", async t => {
  const f = fixture(t);
  const recipient = f.sqlite.prepare("SELECT username FROM users WHERE id=?").get(f.users[1]) as { username: string };
  const story = await f.create(f.users[0], [], { text: `Hello @${recipient.username}` });
  assert.ok(story.id);
  assert.equal((f.sqlite.prepare("SELECT count(*) AS n FROM story_mentions WHERE recipient_id=?").get(f.users[1]) as any).n, 1);
  const read = async () => JSON.stringify(await (await notificationsRequest(new Request("https://test/api/notifications"), f.db, f.users[1], "/notifications")).json());
  assert.match(await read(), /mentioned you in a Status/);
  f.sqlite.prepare("UPDATE users SET is_private=1 WHERE id=?").run(f.users[0]);
  assert.doesNotMatch(await read(), /mentioned you in a Status/);
  f.sqlite.prepare("UPDATE users SET is_private=0 WHERE id=?").run(f.users[0]);
  f.sqlite.prepare(`INSERT INTO account_state(user_id,data,updated_at) VALUES(?,json_object('taggingPreferences',json_object('whoCanTag','nobody')),?)
    ON CONFLICT(user_id) DO UPDATE SET data=json_set(account_state.data,'$.taggingPreferences.whoCanTag','nobody')`).run(f.users[1], Date.now());
  await assert.rejects(f.create(f.users[0], [], { text: `Hello @${recipient.username}` }), (e: any) => e.status === 403);
  const capability = await f.request(f.users[0], "/stories/capabilities");
  assert.equal(capability.status, 200);
  assert.deepEqual(await capability.json(), { stickers: true, privateQuestions: true, mentions: true });
});

test("Story moderation blocks unsafe text before creating a Story", async t => {
  const f = fixture(t);
  const blockedAi = { async run() {
    return { answers: { clear_violation: { noul: 0.98 }, needs_review: { noul: 0.01 } } };
  } };
  const request = storyRequest(new Request("https://test/api/stories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "blocked moderation fixture", visibility: "public" }),
  }), f.db, reviewMediaBucket, f.users[0], "/stories", blockedAi);
  await assert.rejects(request, (error: any) => error.status === 422 && /Nothing was published/.test(error.message));
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM stories WHERE author_id=?").get(f.users[0])?.n, 0);
});

test("Story media upload is reviewed before becoming visible; incomplete placeholders stay hidden", async t => {
  const f = fixture(t);
  const pending = await f.create(f.users[0], [], { mediaType: "photo" });
  const blockedAi = { async run() {
    return { answers: { clear_violation: { noul: 0.97 }, needs_review: { noul: 0.01 } } };
  } };
  const rejectedUpload = new Request(`https://test/api/stories/${pending.id}/media`, {
    method: "POST",
    headers: { "content-type": "image/jpeg" },
    body: new Uint8Array([0xff, 0xd8, 0xff]),
  });
  await assert.rejects(
    storyRequest(rejectedUpload, f.db, reviewMediaBucket, f.users[0], `/stories/${pending.id}/media`, blockedAi),
    (error: any) => error.status === 422 && /Nothing was published/.test(error.message),
  );
  const feed = await (await f.request(f.users[1], "/stories")).json() as any;
  assert.ok(!feed.stories.some((story: any) => story.id === pending.id));
  assert.equal(
    (f.sqlite.prepare("SELECT media_ready FROM stories WHERE id=?").get(pending.id) as any).media_ready,
    0,
    "the rejected asset is never linked to the Story",
  );
});

test("question stickers have editable optional titles; submissions are private, idempotent and bounded", async t => {
  const f = fixture(t), [owner, sender, stranger] = f.users;
  const story = await f.create(owner, [{ kind: "questions", title: "Weekend questions", prompt: "What would you like to know?" }]);
  assert.equal(story.stickers[0].title, "Weekend questions");
  const path = `/stories/${story.id}/stickers/${story.stickers[0].id}/questions`;
  const id = randomUUID(), payload = { clientId: id, body: "A private question just for you" };
  assert.equal((await f.request(sender, path, "POST", payload)).status, 201);
  assert.equal((await f.request(sender, path, "POST", payload)).status, 201);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM story_questions").get()!.n, 1);
  await assert.rejects(() => f.request(stranger, `/stories/${story.id}/questions`), /not found/i);
  await assert.rejects(() => f.request(sender, `/stories/${story.id}/questions`), /not found/i);
  const inbox = await (await f.request(owner, `/stories/${story.id}/questions`)).json();
  assert.equal(inbox.questions[0].body, payload.body);
  assert.equal(inbox.questions[0].asker.username, "sticker_1");
  const publicData = JSON.stringify(await (await f.request(stranger, "/stories")).json());
  assert.ok(!publicData.includes(payload.body));
  assert.ok(!publicData.includes("@example.test"));
  for (let i = 0; i < 4; i++) await f.request(sender, path, "POST", { clientId: randomUUID(), body: `Question ${i}` });
  await assert.rejects(() => f.request(sender, path, "POST", { clientId: randomUUID(), body: "Too many" }), /enough questions/);
  await assert.rejects(() => f.request(sender, path, "POST", { clientId: id, body: "A changed question" }), /new question request/);
});

test("only the owner can publish an answer and it never reveals the private asker's identity", async t => {
  const f = fixture(t), [owner, sender, stranger] = f.users;
  const story = await f.create(owner, [{ kind: "questions", prompt: "Ask me anything" }]);
  const id = randomUUID(), prompt = "Where was that photo taken?";
  await f.request(sender, `/stories/${story.id}/stickers/${story.stickers[0].id}/questions`, "POST", { clientId: id, body: prompt });
  const answer = { kind: "answer", questionId: id, title: "My answer", prompt, answer: "At the coast." };
  await assert.rejects(() => f.create(stranger, [answer], { answerQuestionId: id }), /private inbox/);
  await assert.rejects(() => f.create(owner, [{ ...answer, prompt: "Forged question" }], { answerQuestionId: id }), /question changed/);
  const published = await f.create(owner, [answer], { answerQuestionId: id });
  assert.equal(published.stickers[0].answer, "At the coast.");
  assert.equal(f.sqlite.prepare("SELECT answer_story_id FROM story_questions WHERE id=?").get(id)!.answer_story_id, published.id);
  assert.equal(published.stickers[0].asker, undefined);
  assert.equal(published.stickers[0].questionId, undefined);
  assert.ok(!JSON.stringify(published).includes("sticker_1"));
});

test("private question and answer notifications reach only the right people and retain repeated answers", async t => {
  const f = fixture(t), [owner, asker, stranger] = f.users;
  const source = await f.create(owner, [{ kind:"questions", prompt:"Ask me anything" }]);
  const questionId = randomUUID(), body = "A confidential question not for notification previews";
  const path = `/stories/${source.id}/stickers/${source.stickers[0].id}/questions`;
  await f.request(asker, path, "POST", { clientId:questionId, body });
  await f.request(asker, path, "POST", { clientId:questionId, body });
  const notices = async (actor: string) => (await (await notificationsRequest(
    new Request(`https://test/api/notifications?before=${Date.now()+100}`), f.db, actor, "/notifications")).json()).notifications;
  const questions = (await notices(owner)).filter((n: any) => n.kind === "story-question");
  assert.equal(questions.length, 1);
  assert.equal(questions[0].questionId, questionId);
  assert.equal(questions[0].actor.id, asker);
  assert.ok(!JSON.stringify(questions).includes(body));
  assert.equal((await notices(stranger)).length, 0);
  assert.equal((await notices(asker)).length, 0);
  const focused = await (await f.request(owner, `/stories/${source.id}/questions?questionId=${questionId}`)).json();
  assert.equal(focused.questions[0].body, body);
  await assert.rejects(() => f.request(stranger, `/stories/${source.id}/questions?questionId=${questionId}`), /not found/i);
  const answer = { kind:"answer", questionId, prompt:body, answer:"Here is my answer." };
  const first = await f.create(owner, [answer], { answerQuestionId:questionId });
  await f.create(owner, [{ ...answer, answer:"A second answer." }], { answerQuestionId:questionId });
  const replies = (await notices(asker)).filter((n: any) => n.kind === "story-answer");
  assert.equal(replies.length, 2);
  assert.ok(replies.some((n: any) => n.storyId === first.id));
  assert.ok(replies.every((n: any) => n.questionId === questionId && n.actor.id === owner && n.commentId === null));
  assert.ok(!JSON.stringify(replies).includes(body));
  assert.equal((await notices(owner)).filter((n: any) => n.kind === "story-answer").length, 0);
  assert.equal((await notices(stranger)).length, 0);
  const limited = await f.create(owner, [answer], { answerQuestionId:questionId, visibility:"followers" });
  const privateNotice = (await notices(asker)).find((n: any) => n.id.endsWith(limited.id));
  assert.ok(privateNotice);
  assert.equal(privateNotice.storyId, null, "acknowledges the answer without exposing restricted media");
  f.sqlite.prepare("UPDATE stories SET expires_at=? WHERE id=?").run(Date.now()-1000, source.id);
  assert.equal((await f.request(owner, `/stories/${source.id}/questions?questionId=${questionId}`)).status, 200);
});

test("trend joins preserve the root; participants obey current privacy and blocks", async t => {
  const f = fixture(t), [owner, participant, viewer] = f.users;
  const root = await f.create(owner, [{ kind: "hey-world", title: "Today", prompt: "Your view right now" }]);
  const source = root.stickers[0];
  const joined = await f.create(participant, [{ kind: "hey-world", title: "My view", prompt: source.prompt, sourceStickerId: source.id }]);
  assert.equal(joined.stickers[0].rootId, source.id);
  const path = `/stories/${root.id}/stickers/${source.id}/participants`;
  assert.equal((await (await f.request(viewer, path)).json()).participants.length, 2);
  f.sqlite.prepare("UPDATE users SET is_private=1 WHERE id=?").run(participant);
  f.sqlite.prepare("UPDATE stories SET visibility='followers' WHERE id=?").run(joined.id);
  const visible = await (await f.request(viewer, path)).json();
  assert.equal(visible.participants.length, 1);
  assert.equal(visible.participants[0].author.id, owner);
  await assert.rejects(() => f.create(viewer, [{ kind: "hey-world", prompt: "Different", sourceStickerId: source.id }]), /original prompt/);
  f.sqlite.prepare("INSERT INTO account_blocks(owner_id,blocked_id,created_at) VALUES(?,?,?)").run(owner, viewer, Date.now());
  await assert.rejects(() => f.request(viewer, path), /not found/);
});

test("expiry, duplicate kinds, invalid geometry and oversized titles fail without partial publication", async t => {
  const f = fixture(t), [owner, sender] = f.users;
  const before = () => Number(f.sqlite.prepare("SELECT count(*) AS n FROM stories").get()!.n);
  await assert.rejects(() => f.create(owner, [{ kind: "questions", title: "x".repeat(61) }]), /Add text or media/);
  await assert.rejects(() => f.create(owner, [{ kind: "questions", x: 2 }]), /Add text or media/);
  await assert.rejects(() => f.create(owner, [{ kind: "questions" }, { kind: "questions" }]), /one of each/);
  assert.equal(before(), 0);
  const story = await f.create(owner, [{ kind: "questions" }]);
  f.sqlite.prepare("UPDATE stories SET expires_at=? WHERE id=?").run(Date.now() - 1, story.id);
  await assert.rejects(() => f.request(sender, `/stories/${story.id}/stickers/${story.stickers[0].id}/questions`, "POST", { clientId: randomUUID(), body: "Late" }), /not found/);
  assert.equal((await f.request(owner, `/stories/${story.id}/questions`)).status, 200);
});
