CREATE TABLE story_mentions (
  id TEXT PRIMARY KEY NOT NULL,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE(story_id, recipient_id)
);
CREATE INDEX story_mentions_recipient_time ON story_mentions(recipient_id, created_at DESC);
