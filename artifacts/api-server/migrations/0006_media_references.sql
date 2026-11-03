-- Metadata only: prevent deleting files used by JSON-backed editors/profiles.
CREATE TABLE media_references (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  media_id TEXT NOT NULL REFERENCES user_media_assets(id) ON DELETE RESTRICT,
  PRIMARY KEY(user_id,target_type,target_id,media_id)
);
CREATE INDEX media_references_media_idx ON media_references(media_id);
ALTER TABLE blast_account_state ADD COLUMN write_nonce TEXT;
DROP TRIGGER IF EXISTS d1_user_media_assets_user_id_users_id_fk_delete;
CREATE TRIGGER d1_user_media_assets_user_id_users_id_fk_delete
BEFORE DELETE ON users FOR EACH ROW BEGIN
  DELETE FROM media_references WHERE user_id=OLD.id;
  DELETE FROM user_media_assets WHERE user_id=OLD.id;
END;
