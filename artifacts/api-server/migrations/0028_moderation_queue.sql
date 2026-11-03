CREATE TABLE IF NOT EXISTS moderation_staff (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL DEFAULT 'reviewer' CHECK(role IN ('reviewer','admin'))
);
CREATE TABLE IF NOT EXISTS moderation_decisions (
 report_key TEXT PRIMARY KEY,
 status TEXT NOT NULL CHECK(status IN ('open','reviewed','dismissed')),
 note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=500),
 moderator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 updated_at INTEGER NOT NULL
);
