-- Retain only the request hash and post ID so ambiguous client retries can
-- recover a confirmed publication without storing post content twice.
CREATE TABLE post_idempotency_keys (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) = 36),
  payload_hash TEXT NOT NULL CHECK(length(payload_hash) = 64),
  post_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, idempotency_key)
);
