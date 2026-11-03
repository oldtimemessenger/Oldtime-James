-- Additive topic metadata only. Existing posts, media and Following are untouched.
CREATE TABLE discovery_topics (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate','qualified','merged','suppressed')),
  curated INTEGER NOT NULL DEFAULT 0 CHECK(curated IN(0,1)),
  registered_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  sensitive INTEGER NOT NULL DEFAULT 0 CHECK(sensitive IN(0,1)),
  merged_into TEXT REFERENCES discovery_topics(id),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  checked_at INTEGER NOT NULL DEFAULT 0,
  public_posts INTEGER NOT NULL DEFAULT 0,
  public_creators INTEGER NOT NULL DEFAULT 0,
  count_capped INTEGER NOT NULL DEFAULT 0,
  trend_score REAL NOT NULL DEFAULT 0,
  recent_posts INTEGER NOT NULL DEFAULT 0,
  previous_posts INTEGER NOT NULL DEFAULT 0,
  recent_creators INTEGER NOT NULL DEFAULT 0,
  recent_engagement INTEGER NOT NULL DEFAULT 0,
  qualified_at INTEGER
);
CREATE INDEX discovery_topic_refresh_idx ON discovery_topics(checked_at,last_seen_at DESC);
CREATE INDEX discovery_topic_creator_cap_idx ON discovery_topics(registered_by,created_at);
CREATE INDEX discovery_topic_ranking_idx ON discovery_topics(status,trend_score DESC,last_seen_at DESC);
CREATE TABLE discovery_topic_aliases (
  normalized_name TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES discovery_topics(id),
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX discovery_topic_alias_target_idx ON discovery_topic_aliases(topic_id);
CREATE TABLE discovery_topic_relations (
  parent_id TEXT NOT NULL REFERENCES discovery_topics(id),
  child_id TEXT NOT NULL REFERENCES discovery_topics(id),
  PRIMARY KEY(parent_id,child_id), CHECK(parent_id<>child_id)
);
CREATE TABLE discovery_topic_user_interests (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES discovery_topics(id),
  score REAL NOT NULL DEFAULT 0,
  followed INTEGER NOT NULL DEFAULT 0 CHECK(followed IN(0,1)),
  decay_day INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,topic_id)
);
-- One credit per actor/topic/kind/day limits spam and avoids raw search history.
CREATE TABLE discovery_topic_signal_days (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES discovery_topics(id),
  day INTEGER NOT NULL,
  kind TEXT NOT NULL,
  credited INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,topic_id,day,kind)
);
CREATE INDEX discovery_topic_signal_expiry_idx ON discovery_topic_signal_days(day);
CREATE TABLE discovery_topic_metrics (
  topic_id TEXT NOT NULL REFERENCES discovery_topics(id),
  day INTEGER NOT NULL,
  posts INTEGER NOT NULL DEFAULT 0,
  creators INTEGER NOT NULL DEFAULT 0,
  engagement INTEGER NOT NULL DEFAULT 0,
  searches INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(topic_id,day)
);
CREATE INDEX discovery_topic_metrics_expiry_idx ON discovery_topic_metrics(day);
CREATE TABLE discovery_topic_policy (
  id TEXT PRIMARY KEY CHECK(id='main'),
  min_posts INTEGER NOT NULL DEFAULT 3 CHECK(min_posts BETWEEN 2 AND 100),
  min_creators INTEGER NOT NULL DEFAULT 2 CHECK(min_creators BETWEEN 2 AND 50),
  min_unique_content INTEGER NOT NULL DEFAULT 3 CHECK(min_unique_content BETWEEN 2 AND 100),
  min_confidence REAL NOT NULL DEFAULT 0.6 CHECK(min_confidence BETWEEN 0.5 AND 1)
);
INSERT INTO discovery_topic_policy(id) VALUES('main');
ALTER TABLE discovery_documents ADD COLUMN topic_fingerprint TEXT NOT NULL DEFAULT '';
CREATE INDEX discovery_automatic_pending_idx ON discovery_documents(post_id) WHERE pipeline_version<>'topic-registry-1';
CREATE TRIGGER users_topic_privacy_change AFTER UPDATE OF is_private ON users WHEN new.is_private<>old.is_private BEGIN
  UPDATE discovery_documents SET pipeline_version='' WHERE post_id IN(SELECT id FROM posts WHERE author_id=new.id);
  UPDATE discovery_topics SET checked_at=0 WHERE id IN(
    SELECT topic_id FROM discovery_post_topics WHERE post_id IN(SELECT id FROM posts WHERE author_id=new.id));
END;
CREATE TRIGGER posts_topic_archive_change AFTER UPDATE OF archived_at ON posts WHEN new.archived_at IS NOT old.archived_at BEGIN
  UPDATE discovery_documents SET pipeline_version='' WHERE post_id=new.id;
  UPDATE discovery_topics SET checked_at=0 WHERE id IN(SELECT topic_id FROM discovery_post_topics WHERE post_id=new.id);
END;
CREATE TRIGGER posts_topic_delete BEFORE DELETE ON posts BEGIN
  UPDATE discovery_topics SET checked_at=0 WHERE id IN(SELECT topic_id FROM discovery_post_topics WHERE post_id=old.id);
END;
CREATE TABLE discovery_topic_moderation_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  topic_id TEXT NOT NULL REFERENCES discovery_topics(id),
  target_id TEXT REFERENCES discovery_topics(id),
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
