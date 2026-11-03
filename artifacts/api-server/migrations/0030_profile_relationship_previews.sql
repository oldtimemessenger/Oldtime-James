-- Bounded profile-header previews and existing relationship totals/list reads.
CREATE INDEX IF NOT EXISTS user_follows_followed_time_idx ON user_follows(followed_id,created_at DESC,follower_id);
CREATE INDEX IF NOT EXISTS user_follows_follower_time_idx ON user_follows(follower_id,created_at DESC,followed_id);
