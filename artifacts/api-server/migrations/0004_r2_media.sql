CREATE TABLE IF NOT EXISTS media_upload_sessions (
  media_id TEXT PRIMARY KEY REFERENCES user_media_assets(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  upload_id TEXT NOT NULL,
  offset INTEGER NOT NULL DEFAULT 0,
  parts TEXT NOT NULL DEFAULT '[]',
  lease_until INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS media_read_tokens (
  token_hash TEXT PRIMARY KEY,
  media_id TEXT NOT NULL REFERENCES user_media_assets(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS media_read_tokens_expiry_idx ON media_read_tokens(expires_at);
