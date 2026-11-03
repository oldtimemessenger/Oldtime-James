-- Additive only: keep all existing accounts, posts and place tags.
CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon REAL NOT NULL CHECK (lon BETWEEN -180 AND 180),
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS place_reviews (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES places(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tip TEXT NOT NULL DEFAULT '' CHECK (length(tip) <= 200),
  tags TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(place_id, user_id)
);
CREATE INDEX IF NOT EXISTS place_reviews_recent ON place_reviews(place_id, updated_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS place_review_reports (
  review_id TEXT NOT NULL REFERENCES place_reviews(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(review_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS posts_place_id ON posts(json_extract(place, '$.id')) WHERE place IS NOT NULL;
