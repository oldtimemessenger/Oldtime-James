-- Additive only: existing accounts, posts, messages and media are untouched.
CREATE TABLE IF NOT EXISTS community_feed_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS community_lists (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS community_lists_owner ON community_lists(owner_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS community_lists_public ON community_lists(is_public,updated_at DESC);
CREATE TABLE IF NOT EXISTS community_list_members (
  list_id TEXT NOT NULL REFERENCES community_lists(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(list_id,user_id)
);
CREATE TABLE IF NOT EXISTS community_list_follows (
  list_id TEXT NOT NULL REFERENCES community_lists(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(list_id,user_id)
);
CREATE INDEX IF NOT EXISTS community_list_follows_user ON community_list_follows(user_id,list_id);
CREATE TABLE IF NOT EXISTS community_post_labels (
  post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'und',
  kind TEXT NOT NULL DEFAULT 'post' CHECK(kind IN ('post','reply','quote'))
);
