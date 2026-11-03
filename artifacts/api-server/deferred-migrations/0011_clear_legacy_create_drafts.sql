-- The user authorized removing all saved drafts from the retired Create flow.
-- Remove draft references first; assets still used by published content,
-- Stories, chats, profile media, thumbnails, or any other reference are kept.
DELETE FROM media_references WHERE target_type='draft';

INSERT OR IGNORE INTO r2_deletion_queue(object_key,upload_id,queued_at)
SELECT m.object_key,
  (SELECT s.upload_id FROM media_upload_sessions s WHERE s.media_id=m.id),
  CAST(strftime('%s','now') AS INTEGER)*1000
FROM user_media_assets m
WHERE m.id IN (
  SELECT DISTINCT substr(media.value,15)
  FROM creative_drafts d, json_each(d.data,'$.media') media
  WHERE media.value LIKE 'oldtime-media:%'
)
AND NOT EXISTS(SELECT 1 FROM post_media_assets pm WHERE pm.media_id=m.id)
AND NOT EXISTS(SELECT 1 FROM chat_message_media cm WHERE cm.media_id=m.id)
AND NOT EXISTS(SELECT 1 FROM user_media_assets parent WHERE parent.thumbnail_id=m.id)
AND NOT EXISTS(SELECT 1 FROM stories s WHERE s.media_path=m.object_key)
AND NOT EXISTS(SELECT 1 FROM media_references r WHERE r.media_id=m.id)
AND NOT EXISTS(SELECT 1 FROM account_state a WHERE
  json_extract(a.data,'$.profile.avatar')='oldtime-media:'||m.id OR
  json_extract(a.data,'$.profile.cover')='oldtime-media:'||m.id);

DELETE FROM user_media_assets
WHERE id IN (
  SELECT DISTINCT substr(media.value,15)
  FROM creative_drafts d, json_each(d.data,'$.media') media
  WHERE media.value LIKE 'oldtime-media:%'
)
AND NOT EXISTS(SELECT 1 FROM post_media_assets pm WHERE pm.media_id=user_media_assets.id)
AND NOT EXISTS(SELECT 1 FROM chat_message_media cm WHERE cm.media_id=user_media_assets.id)
AND NOT EXISTS(SELECT 1 FROM user_media_assets parent WHERE parent.thumbnail_id=user_media_assets.id)
AND NOT EXISTS(SELECT 1 FROM stories s WHERE s.media_path=user_media_assets.object_key)
AND NOT EXISTS(SELECT 1 FROM media_references r WHERE r.media_id=user_media_assets.id)
AND NOT EXISTS(SELECT 1 FROM account_state a WHERE
  json_extract(a.data,'$.profile.avatar')='oldtime-media:'||user_media_assets.id OR
  json_extract(a.data,'$.profile.cover')='oldtime-media:'||user_media_assets.id);

DELETE FROM creative_drafts;
