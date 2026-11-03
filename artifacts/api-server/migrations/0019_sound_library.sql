CREATE TABLE sound_library (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  creator_id TEXT NOT NULL,
  creator_username TEXT NOT NULL,
  creator_display_name TEXT NOT NULL,
  media_id TEXT NOT NULL UNIQUE REFERENCES user_media_assets(id) ON DELETE RESTRICT,
  source_post_id TEXT UNIQUE REFERENCES posts(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Original audio' CHECK(length(title) BETWEEN 1 AND 100),
  rights_confirmed_at INTEGER NOT NULL,
  reuse_allowed INTEGER NOT NULL DEFAULT 1 CHECK(reuse_allowed IN (0, 1)),
  created_at INTEGER NOT NULL
);
CREATE INDEX sound_library_discovery_idx
  ON sound_library(reuse_allowed, created_at DESC);
CREATE INDEX sound_library_owner_idx
  ON sound_library(owner_id, created_at DESC);

CREATE TABLE sound_saves (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sound_id TEXT NOT NULL REFERENCES sound_library(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, sound_id)
);
CREATE INDEX sound_saves_sound_idx ON sound_saves(sound_id);

ALTER TABLE posts ADD COLUMN audio_sound_id TEXT REFERENCES sound_library(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN audio_source_sound_id TEXT REFERENCES sound_library(id) ON DELETE SET NULL;
CREATE INDEX posts_audio_source_sound_idx
  ON posts(audio_source_sound_id)
  WHERE audio_source_sound_id IS NOT NULL;

CREATE TRIGGER sound_library_media_reference_cleanup AFTER DELETE ON sound_library
FOR EACH ROW BEGIN
  DELETE FROM media_references WHERE target_type='sound' AND target_id=OLD.id;
END;

DROP TRIGGER IF EXISTS d1_user_media_assets_user_id_users_id_fk_delete;
CREATE TRIGGER d1_user_media_assets_user_id_users_id_fk_delete
BEFORE DELETE ON users FOR EACH ROW BEGIN
  UPDATE user_media_assets SET user_id=(SELECT id FROM users WHERE username='oldtime' LIMIT 1)
    WHERE id IN (SELECT media_id FROM sound_library WHERE creator_id=OLD.id)
      AND EXISTS(SELECT 1 FROM users WHERE username='oldtime');
  UPDATE media_references SET user_id=(SELECT id FROM users WHERE username='oldtime' LIMIT 1)
    WHERE target_type='sound' AND target_id IN (SELECT id FROM sound_library WHERE creator_id=OLD.id)
      AND EXISTS(SELECT 1 FROM users WHERE username='oldtime');
  UPDATE sound_library SET owner_id=NULL WHERE creator_id=OLD.id;
  DELETE FROM media_references WHERE user_id=OLD.id;
  DELETE FROM user_media_assets WHERE user_id=OLD.id
    AND id NOT IN (SELECT media_id FROM sound_library WHERE creator_id=OLD.id);
END;
