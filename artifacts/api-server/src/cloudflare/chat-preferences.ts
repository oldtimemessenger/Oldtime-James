import { z } from "zod/v4";
import { ApiError, body, json, object, type Database } from "./runtime";

const audience = z.enum(["everyone", "following", "none"]);
export const chatPreferencesSchema = z.object({
  directMessages: audience,
  groupInvites: audience,
  readReceipts: z.boolean(),
}).strict();
export type ChatPreferences = z.infer<typeof chatPreferencesSchema>;

export function chatPreferences(data: string | null): ChatPreferences {
  const state = object(data), saved = object(state.chatPreferences);
  return {
    directMessages: audience.safeParse(saved.directMessages).success ? saved.directMessages as ChatPreferences["directMessages"] : "everyone",
    groupInvites: audience.safeParse(saved.groupInvites).success ? saved.groupInvites as ChatPreferences["groupInvites"] : "everyone",
    readReceipts: typeof saved.readReceipts === "boolean" ? saved.readReceipts : object(state.settings).readReceipts !== false,
  };
}

export async function chatPreferencesRequest(request: Request, db: Database, userId: string) {
  if (request.method === "GET") {
    const record = await db.prepare("SELECT data FROM account_state WHERE user_id=?").bind(userId).first<{data:string}>();
    return json({ preferences: chatPreferences(record?.data ?? null) });
  }
  if (request.method !== "PUT") throw new ApiError(405, "Method not allowed.");
  const parsed = chatPreferencesSchema.safeParse(await body(request));
  if (!parsed.success) throw new ApiError(400, "Choose valid chat settings.");
  const preferences = parsed.data, encoded = JSON.stringify(preferences);
  await db.prepare(`INSERT INTO account_state(user_id,data,updated_at) VALUES(?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET data=json_set(COALESCE(account_state.data,'{}'),
      '$.chatPreferences',json(?),'$.settings.readReceipts',json(?)),updated_at=excluded.updated_at`)
    .bind(userId, JSON.stringify({chatPreferences:preferences,settings:{readReceipts:preferences.readReceipts}}),
      Date.now(), encoded, JSON.stringify(preferences.readReceipts)).run();
  return json({ preferences });
}

export async function enforceNewChatPermissions(db: Database, sender: string, ids: string[]) {
  const group = ids.length > 2;
  for (const recipient of ids.filter(id => id !== sender)) {
    if (!group) {
      const existing = await db.prepare(`SELECT mine.conversation_id FROM chat_members mine JOIN chat_members peer
        ON peer.conversation_id=mine.conversation_id WHERE mine.user_id=? AND peer.user_id=?
        AND (SELECT count(*) FROM chat_members all_members WHERE all_members.conversation_id=mine.conversation_id)=2 LIMIT 1`)
        .bind(sender,recipient).first();
      if (existing) continue;
    }
    const record = await db.prepare("SELECT data FROM account_state WHERE user_id=?").bind(recipient).first<{data:string}>();
    const preferences = chatPreferences(record?.data ?? null);
    const permission = group ? preferences.groupInvites : preferences.directMessages;
    const follows = permission === "following" && await db.prepare(
      "SELECT 1 FROM user_follows WHERE follower_id=? AND followed_id=?",
    ).bind(recipient,sender).first();
    if (permission === "none" || permission === "following" && !follows) {
      throw new ApiError(403, group
        ? "This person is not accepting new group invites from you."
        : "This person is not accepting new messages from you. Existing conversations remain available.");
    }
  }
}
