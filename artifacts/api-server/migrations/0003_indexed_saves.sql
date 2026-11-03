-- Saved identities remain private; feeds query only aggregate counts.
CREATE TABLE IF NOT EXISTS post_saves (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS post_saves_post_idx ON post_saves(post_id);
