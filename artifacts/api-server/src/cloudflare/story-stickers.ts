import { z } from "zod/v4";
import { ApiError, body, json, rows, publicDetails, viewerCte, visibleStory, type Database } from "./runtime";

export const storyStickerInput = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["questions", "trendsetters", "hey-world", "answer"]),
  title: z.string().trim().max(60).default(""),
  prompt: z.string().trim().max(300).default(""),
  answer: z.string().trim().max(600).optional(),
  questionId: z.string().uuid().optional(),
  sourceStickerId: z.string().uuid().optional(),
  x: z.number().min(0).max(1).default(.5),
  y: z.number().min(0).max(1).default(.55),
  width: z.number().min(.15).max(1).default(.7),
  height: z.number().min(.08).max(.8).default(.24),
  rotation: z.number().min(-180).max(180).default(0),
}).strict();
type StickerInput = z.infer<typeof storyStickerInput>;
type StoryAccess = { id: string; author_id: string; expires_at: number; saved_to_profile: number };
type ResolveStory = (id: string, owned?: boolean) => Promise<StoryAccess | null>;
type StickerRow = {
  id: string; story_id: string; kind: StickerInput["kind"]; title: string; prompt: string;
  answer: string; x: number; y: number; width: number; height: number; rotation: number; root_id: string | null;
};
const defaults = { questions: "Ask me anything", trendsetters: "Share your take", "hey-world": "Show us your world", answer: "" };
const dto = (s: StickerRow) => ({
  id: s.id, kind: s.kind, title: s.title, prompt: s.prompt,
  ...(s.kind === "answer" ? { answer: s.answer } : {}),
  x: s.x, y: s.y, width: s.width, height: s.height, rotation: s.rotation, rootId: s.root_id || s.id,
});

// Public metadata never contains askers, unanswered questions or private inbox IDs.
export async function stickersForStories(db: Database, storyIds: string[]) {
  const result = new Map<string, ReturnType<typeof dto>[]>();
  if (!storyIds.length) return result;
  const ids = [...new Set(storyIds)];
  // D1's statement binding limit is lower than the size of the existing story feed.
  for (let offset = 0; offset < ids.length; offset += 80) {
    const page = ids.slice(offset, offset + 80);
    const data = await rows<StickerRow>(db, `SELECT * FROM story_stickers WHERE story_id IN (${page.map(() => "?").join(",")}) ORDER BY rowid`, ...page);
    for (const row of data) result.set(row.story_id, [...(result.get(row.story_id) || []), dto(row)]);
  }
  return result;
}

export async function prepareStoryStickers(db: Database, owner: string, storyId: string,
  inputs: StickerInput[], answerQuestionId: string | undefined, resolve: ResolveStory, hasReplyMedia = false) {
  if (new Set(inputs.map(s => s.kind)).size !== inputs.length) throw new ApiError(400, "Use only one of each sticker per Status.");
  const answer = inputs.find(s => s.kind === "answer");
  if (Boolean(answer) !== Boolean(answerQuestionId) || answer && answer.questionId !== answerQuestionId)
    throw new ApiError(400, "Choose a question from your private inbox before answering.");
  const writes = [];
  for (const input of inputs) {
    const id = crypto.randomUUID();
    let prompt = input.prompt || defaults[input.kind];
    let root: string = id;
    if (input.sourceStickerId) {
      if (!["trendsetters", "hey-world"].includes(input.kind)) throw new ApiError(400, "This sticker cannot be joined.");
      const source = await db.prepare("SELECT * FROM story_stickers WHERE id=?").bind(input.sourceStickerId).first<StickerRow>();
      const story = source ? await resolve(source.story_id) : null;
      if (!source || source.kind !== input.kind || !story || story.expires_at <= Date.now())
        throw new ApiError(404, "This trend is no longer available.");
      if (prompt !== source.prompt) throw new ApiError(409, "Keep the original prompt, or add a new sticker to start your own trend.");
      root = source.root_id || source.id;
    }
    if (input.kind === "answer") {
      const question = await db.prepare(`SELECT q.body FROM story_questions q JOIN stories s ON s.id=q.story_id
        WHERE q.id=? AND s.author_id=? AND NOT EXISTS(SELECT 1 FROM account_blocks b
          WHERE (b.owner_id=? AND b.blocked_id=q.asker_id) OR (b.blocked_id=? AND b.owner_id=q.asker_id))`)
        .bind(answerQuestionId, owner, owner, owner).first<{ body: string }>();
      if (!question) throw new ApiError(404, "Question not found in your private inbox.");
      if (input.prompt !== question.body) throw new ApiError(409, "The question changed. Reopen it from your inbox.");
      if (!input.answer?.trim() && !hasReplyMedia) throw new ApiError(400, "Write your answer or add response media before sharing.");
      prompt = question.body;
    }
    writes.push(db.prepare(`INSERT INTO story_stickers(id,story_id,kind,title,prompt,answer,x,y,width,height,rotation,root_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, storyId, input.kind, input.title, prompt, input.answer || "",
      input.x, input.y, input.width, input.height, input.rotation, root));
  }
  if (answerQuestionId) {
    writes.push(db.prepare("INSERT INTO story_question_answers(story_id,question_id) VALUES(?,?)").bind(storyId,answerQuestionId));
    writes.push(db.prepare("UPDATE story_questions SET answer_story_id=? WHERE id=?").bind(storyId, answerQuestionId));
  }
  return writes;
}

export async function storyStickerRequest(request: Request, db: Database, userId: string, path: string, resolve: ResolveStory): Promise<Response | null> {
  const questionRoute = /^\/stories\/([a-f0-9-]{36})\/questions$/.exec(path);
  if (questionRoute && request.method === "GET") {
    const story = await resolve(questionRoute[1], true);
    if (!story) throw new ApiError(404, "Private question inbox not found.");
    const q = new URL(request.url).searchParams;
    const offset = Number(q.get("offset") || 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 2000) throw new ApiError(400, "Choose a valid inbox page.");
    const questionId=q.get("questionId");
    if(questionId&&!z.string().uuid().safeParse(questionId).success)throw new ApiError(400,"Choose a valid question.");
    const data = await rows<{ id: string; body: string; created_at: number; answer_story_id: string | null; username: string; display_name: string }>(db,
      `SELECT q.id,q.body,q.created_at,q.answer_story_id,u.username,u.display_name FROM story_questions q JOIN users u ON u.id=q.asker_id
       WHERE q.story_id=? ${questionId?"AND q.id=?":""} AND NOT EXISTS(SELECT 1 FROM account_blocks b
       WHERE (b.owner_id=? AND b.blocked_id=q.asker_id) OR (b.blocked_id=? AND b.owner_id=q.asker_id))
       ORDER BY q.created_at DESC,q.id DESC LIMIT 31 OFFSET ?`, story.id, ...(questionId?[questionId]:[]), userId, userId, offset);
    return json({ questions: data.slice(0, 30).map(q => ({ id: q.id, body: q.body, createdAt: q.created_at,
      answerStoryId: q.answer_story_id, asker: { username: q.username, displayName: q.display_name } })),
      hasMore: data.length > 30, nextOffset: offset + Math.min(30, data.length) });
  }
  const match = /^\/stories\/([a-f0-9-]{36})\/stickers\/([a-f0-9-]{36})\/(questions|participants)$/.exec(path);
  if (!match) return null;
  const [, storyId, stickerId, action] = match;
  const story = await resolve(storyId);
  if (!story || story.expires_at <= Date.now()) throw new ApiError(404, "Status not found or no longer available.");
  const sticker = await db.prepare("SELECT * FROM story_stickers WHERE id=? AND story_id=?").bind(stickerId, storyId).first<StickerRow>();
  if (!sticker) throw new ApiError(404, "Sticker not found.");
  if (action === "questions" && request.method === "POST") {
    if (sticker.kind !== "questions" || story.author_id === userId) throw new ApiError(400, "Choose another member's question sticker.");
    const input = z.object({ clientId: z.string().uuid(), body: z.string().trim().min(1).max(300) }).strict().safeParse(await body(request));
    if (!input.success) throw new ApiError(400, "Write a question of up to 300 characters.");
    const previous = await db.prepare("SELECT id,asker_id,sticker_id,body FROM story_questions WHERE id=?").bind(input.data.clientId)
      .first<{ id: string; asker_id: string; sticker_id: string; body: string }>();
    if (previous) {
      if (previous.asker_id !== userId || previous.sticker_id !== stickerId || previous.body !== input.data.body)
        throw new ApiError(409, "Choose a new question request.");
      return json({ received: true }, 201);
    }
    const result = await db.prepare(`INSERT INTO story_questions(id,story_id,sticker_id,asker_id,body,created_at)
      SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM story_questions WHERE sticker_id=? AND asker_id=?)<5`)
      .bind(input.data.clientId, storyId, stickerId, userId, input.data.body, Date.now(), stickerId, userId).run();
    if (!result.meta?.changes) throw new ApiError(429, "You've sent enough questions to this Status. Try another time.");
    return json({ received: true }, 201);
  }
  if (action === "participants" && request.method === "GET") {
    if (!["trendsetters", "hey-world"].includes(sticker.kind)) throw new ApiError(400, "This sticker has no participation list.");
    const offset = Number(new URL(request.url).searchParams.get("offset") || 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 2000) throw new ApiError(400, "Choose a valid trend page.");
    const data = await rows<{ story_id: string; id: string; username: string; display_name: string; created_at: number; data: string | null }>(db,
      `${viewerCte} SELECT s.id AS story_id,u.id,u.username,u.display_name,s.created_at,st.data
       FROM story_stickers k JOIN stories s ON s.id=k.story_id JOIN users u ON u.id=s.author_id LEFT JOIN account_state st ON st.user_id=u.id
       WHERE COALESCE(k.root_id,k.id)=? AND ${visibleStory} AND s.expires_at>?
       ORDER BY s.created_at DESC,s.id DESC LIMIT 21 OFFSET ?`, userId, sticker.root_id || sticker.id, Date.now(), offset);
    return json({ participants: data.slice(0, 20).map(p => ({ storyId: p.story_id, createdAt: p.created_at,
      author: { id: p.id, username: p.username, displayName: p.display_name, ...publicDetails(p.data) } })),
      hasMore: data.length > 20, nextOffset: offset + Math.min(20, data.length) });
  }
  throw new ApiError(405, "Method not allowed.");
}
