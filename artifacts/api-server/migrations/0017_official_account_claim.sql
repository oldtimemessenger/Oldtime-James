CREATE TABLE IF NOT EXISTS official_account_claim_requests (
  claim_key TEXT PRIMARY KEY NOT NULL CHECK (claim_key = 'official'),
  email_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS official_account_claim_requests_expires_at_idx
  ON official_account_claim_requests(expires_at);
