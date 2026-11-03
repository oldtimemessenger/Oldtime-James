CREATE TABLE IF NOT EXISTS story_stickers (
  id TEXT PRIMARY KEY NOT NULL,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('questions','trendsetters','hey-world','answer')),
  title TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  x REAL NOT NULL DEFAULT 0.5,
  y REAL NOT NULL DEFAULT 0.55,
  width REAL NOT NULL DEFAULT 0.7,
  height REAL NOT NULL DEFAULT 0.24,
  rotation REAL NOT NULL DEFAULT 0,
  root_id TEXT REFERENCES story_stickers(id) ON DELETE SET NULL,
  UNIQUE(story_id,kind)
);
CREATE INDEX IF NOT EXISTS story_stickers_thread ON story_stickers(root_id,story_id);
CREATE TABLE IF NOT EXISTS story_questions (
  id TEXT PRIMARY KEY NOT NULL,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  sticker_id TEXT NOT NULL REFERENCES story_stickers(id) ON DELETE CASCADE,
  asker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 300),
  created_at INTEGER NOT NULL,
  answer_story_id TEXT REFERENCES stories(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS story_questions_owner_inbox ON story_questions(story_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS story_questions_sender_limit ON story_questions(sticker_id,asker_id,created_at);
