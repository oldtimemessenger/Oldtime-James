CREATE TABLE IF NOT EXISTS feed_recommendation_feedback (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, post_id)
);

CREATE INDEX IF NOT EXISTS feed_recommendation_feedback_owner_created_idx
  ON feed_recommendation_feedback(owner_id, created_at);
