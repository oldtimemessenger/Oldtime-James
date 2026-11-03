-- Additive only. Existing stories remain retained; future stories capture consent.
ALTER TABLE stories ADD COLUMN archive_enabled INTEGER NOT NULL DEFAULT 1 CHECK(archive_enabled IN (0,1));
CREATE INDEX idx_stories_owner_archive ON stories(author_id,archive_enabled,expires_at DESC,id);
