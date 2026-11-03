ALTER TABLE r2_deletion_queue ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE r2_deletion_queue ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE r2_deletion_queue ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE r2_deletion_queue ADD COLUMN last_error TEXT;

CREATE INDEX r2_deletion_queue_retry_idx ON r2_deletion_queue(next_attempt_at, queued_at);

CREATE TABLE media_cleanup_runs (
  scheduled_at INTEGER PRIMARY KEY,
  expired_stories INTEGER NOT NULL DEFAULT 0,
  expired_media_assets INTEGER NOT NULL DEFAULT 0,
  deleted_objects INTEGER NOT NULL DEFAULT 0,
  deleted_bytes INTEGER NOT NULL DEFAULT 0,
  failed_deletions INTEGER NOT NULL DEFAULT 0,
  tracked_assets INTEGER NOT NULL DEFAULT 0,
  tracked_bytes INTEGER NOT NULL DEFAULT 0,
  new_assets_24h INTEGER NOT NULL DEFAULT 0,
  pending_uploads INTEGER NOT NULL DEFAULT 0,
  queued_deletions INTEGER NOT NULL DEFAULT 0
);
