-- Fresh launch: future writes supply deterministic normalization, without a
-- PostgreSQL regexp extension or an external classification service.
ALTER TABLE posts ADD COLUMN text_fingerprint TEXT;
ALTER TABLE posts ADD COLUMN meaningful INTEGER NOT NULL DEFAULT 0 CHECK(meaningful IN (0,1));
ALTER TABLE post_comments ADD COLUMN meaningful INTEGER NOT NULL DEFAULT 0 CHECK(meaningful IN (0,1));
CREATE INDEX posts_creator_fingerprint_idx ON posts(author_id,text_fingerprint,created_at);
