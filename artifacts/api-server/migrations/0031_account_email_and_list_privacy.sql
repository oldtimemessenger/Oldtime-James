-- No account requires email confirmation to register or sign in.
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
-- Existing accounts have unknown history, not a fabricated unverified state.
ALTER TABLE users ADD COLUMN email_verification_known INTEGER NOT NULL DEFAULT 0 CHECK (email_verification_known IN (0,1));
ALTER TABLE users ADD COLUMN followers_visible INTEGER NOT NULL DEFAULT 0 CHECK (followers_visible IN (0,1));
ALTER TABLE users ADD COLUMN following_visible INTEGER NOT NULL DEFAULT 1 CHECK (following_visible IN (0,1));

-- Separate from pending address changes: neither flow cancels the other's links.
CREATE TABLE email_verification_requests (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
