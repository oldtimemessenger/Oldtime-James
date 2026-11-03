CREATE TABLE sound_post_saves (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, source_post_id)
) WITHOUT ROWID;

CREATE INDEX sound_post_saves_user_created_idx
  ON sound_post_saves(user_id, created_at DESC, source_post_id);
