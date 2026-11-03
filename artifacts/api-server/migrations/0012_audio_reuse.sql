ALTER TABLE "posts" ADD COLUMN "audio_source_post_id" TEXT REFERENCES "posts" ("id") ON DELETE SET NULL;
ALTER TABLE "posts" ADD COLUMN "audio_reuse_allowed" INTEGER NOT NULL DEFAULT 0
  CHECK ("audio_reuse_allowed" IN (0, 1));
ALTER TABLE "posts" ADD COLUMN "audio_rights_confirmed_at" INTEGER;

CREATE INDEX IF NOT EXISTS "posts_audio_source_post_idx"
  ON "posts" ("audio_source_post_id")
  WHERE "audio_source_post_id" IS NOT NULL;
