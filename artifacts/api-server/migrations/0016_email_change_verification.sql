CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
  ON users(lower(email));

CREATE TABLE IF NOT EXISTS email_change_requests (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS email_change_requests_expires_at_idx
  ON email_change_requests(expires_at);
