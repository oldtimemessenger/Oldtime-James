-- Persist ordered multi-post Community conversations without duplicating post content.
ALTER TABLE posts ADD COLUMN thread_id TEXT REFERENCES posts(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN thread_position INTEGER;
CREATE UNIQUE INDEX posts_thread_position_unique
  ON posts(thread_id, thread_position)
  WHERE thread_id IS NOT NULL AND thread_position IS NOT NULL;
CREATE INDEX posts_thread_lookup
  ON posts(thread_id, thread_position, created_at)
  WHERE thread_id IS NOT NULL;
