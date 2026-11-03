ALTER TABLE posts ADD COLUMN archived_at INTEGER;

CREATE INDEX posts_archived_owner_idx
  ON posts(author_id, archived_at, created_at DESC, id DESC);
