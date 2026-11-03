CREATE TABLE realtime_tickets(
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX realtime_tickets_owner_expiry_idx ON realtime_tickets(user_id,expires_at);
CREATE INDEX realtime_tickets_expiry_idx ON realtime_tickets(expires_at);
