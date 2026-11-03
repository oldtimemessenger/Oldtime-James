CREATE TABLE IF NOT EXISTS "chat_mentions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "recipient_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL,
  CONSTRAINT "chat_mentions_conversation_fk" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations" ("id") ON DELETE CASCADE,
  CONSTRAINT "chat_mentions_message_fk" FOREIGN KEY ("message_id") REFERENCES "chat_messages" ("id") ON DELETE CASCADE,
  CONSTRAINT "chat_mentions_recipient_fk" FOREIGN KEY ("recipient_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "chat_mentions_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "chat_mentions_not_self_check" CHECK ("recipient_id" <> "actor_id"),
  CONSTRAINT "chat_mentions_unique_recipient" UNIQUE ("message_id", "recipient_id")
);
CREATE INDEX IF NOT EXISTS "chat_mentions_recipient_created_idx"
  ON "chat_mentions" ("recipient_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "chat_mentions_message_idx"
  ON "chat_mentions" ("message_id");
