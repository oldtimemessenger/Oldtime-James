CREATE TABLE r2_deletion_queue (
  object_key TEXT PRIMARY KEY,
  upload_id TEXT,
  queued_at INTEGER NOT NULL
);
CREATE INDEX r2_deletion_queue_time_idx ON r2_deletion_queue(queued_at);
CREATE TRIGGER story_media_reference_cleanup BEFORE DELETE ON stories
FOR EACH ROW BEGIN
  DELETE FROM media_references WHERE target_type='story' AND target_id=OLD.id;
END;
CREATE TABLE place_search_cache (
  cache_key TEXT PRIMARY KEY,
  results TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX place_search_cache_expiry_idx ON place_search_cache(expires_at);
CREATE TABLE external_lookup_limits (
  id TEXT PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 0,
  last_request_at INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
