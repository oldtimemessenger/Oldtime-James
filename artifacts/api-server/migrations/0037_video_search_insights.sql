-- Search Insights: metadata-only indexing and implicit, deduplicated search signals.
-- A video is represented by its owning public post (posts.id); media remains in R2.
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS videos_creator_created_idx ON videos(creator_id, created_at DESC);

CREATE TABLE IF NOT EXISTS video_search_index (
  keyword TEXT NOT NULL,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  weight_score INTEGER NOT NULL DEFAULT 1 CHECK(weight_score >= 1),
  source TEXT NOT NULL DEFAULT 'caption'
    CHECK(source IN ('caption','hashtag','search_phrase','search_term')),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(keyword, video_id, source)
);
CREATE INDEX IF NOT EXISTS video_search_index_video_weight_idx
  ON video_search_index(video_id, weight_score DESC, keyword);
CREATE INDEX IF NOT EXISTS video_search_index_keyword_video_idx
  ON video_search_index(keyword, video_id);

CREATE TABLE IF NOT EXISTS search_clicks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  watch_time INTEGER NOT NULL CHECK(watch_time > 5 AND watch_time <= 3600),
  day_bucket INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, query_text, video_id, day_bucket)
);
CREATE INDEX IF NOT EXISTS search_clicks_video_created_idx
  ON search_clicks(video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS search_clicks_user_created_idx
  ON search_clicks(user_id, created_at DESC);
