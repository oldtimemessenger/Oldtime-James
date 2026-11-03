-- Additive Bot Control Center state. Existing posts, interactions, drafts and
-- account history are retained. The new defaults preserve publishing limits
-- while leaving schedules paused and engagement opt-in and disabled.
ALTER TABLE engine_runtime ADD COLUMN retry_after_at INTEGER;
ALTER TABLE engine_preferences ADD COLUMN allow_virtual_likes INTEGER NOT NULL DEFAULT 0
  CHECK(allow_virtual_likes IN(0,1));
ALTER TABLE engine_actions ADD COLUMN parent_comment_id TEXT;

UPDATE engine_runtime
SET profile=json_set(
  profile,
  '$.repliesEnabled', json('false'),
  '$.maxConsecutiveFailures', 3,
  '$.retryBackoffMinutes', 60,
  '$.sourceFetchIntervalMinutes', 60
)
WHERE id=1;

UPDATE engine_accounts
SET profile=json_set(profile,'$.automation',json(
  '{"permissions":{"publish":true,"comment":false,"reply":false,"like":false,"follow":false},' ||
  '"schedule":{"enabled":false,"timezone":"UTC","daysOfWeek":[0,1,2,3,4,5,6],' ||
  '"startTime":"00:00","endTime":"23:59","intervalMinutes":30,"maxPostsPerDay":1,"maxActionsPerDay":0}}'
))
WHERE json_type(profile,'$.automation') IS NULL;

DROP TRIGGER engine_publication_guard;
CREATE TRIGGER engine_publication_guard BEFORE INSERT ON engine_publications BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM engine_config c,engine_runtime r,engine_drafts d
    JOIN engine_accounts a ON a.id=d.account_id
    JOIN engine_events e ON e.id=d.event_id JOIN engine_sources s ON s.id=e.source_id
    WHERE c.id=1 AND r.id=1 AND c.mode='dry-run' AND json_extract(r.profile,'$.enabled')=1
      AND d.id=NEW.draft_id AND d.revision=NEW.draft_revision AND d.status='approved'
      AND d.event_id=NEW.event_id AND d.account_id=NEW.account_id
      AND a.status='enabled' AND a.visibility='public' AND a.revision=d.account_revision
      AND json_extract(a.profile,'$.automation.permissions.publish')=1
      AND json_extract(a.profile,'$.automation.schedule.enabled')=1
      AND s.status='approved' AND s.revision=d.source_revision AND e.revision=d.event_revision
      AND e.expires_at>NEW.created_at AND json_extract(e.profile,'$.verified')=1
      AND json_extract(e.profile,'$.rightsConfirmed')=1 AND json_extract(e.profile,'$.risk')='routine'
  ) THEN RAISE(ABORT,'engine_publication_ineligible') END;
  SELECT CASE WHEN (SELECT count(*) FROM engine_publications WHERE created_at>=NEW.created_at-3600000)>=
    (SELECT json_extract(profile,'$.hourlyPostLimit') FROM engine_runtime WHERE id=1)
    OR (SELECT count(*) FROM engine_publications WHERE created_at>=NEW.created_at-NEW.created_at%86400000)>=
      (SELECT daily_post_limit FROM engine_config WHERE id=1)
    OR (SELECT count(*) FROM engine_publications WHERE account_id=NEW.account_id AND created_at>=NEW.created_at-NEW.created_at%86400000)>=
      min((SELECT json_extract(profile,'$.perAccountDailyLimit') FROM engine_runtime WHERE id=1),
          (SELECT json_extract(profile,'$.automation.schedule.maxPostsPerDay') FROM engine_accounts WHERE id=NEW.account_id))
    THEN RAISE(ABORT,'engine_publication_quota') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM engine_activity WHERE category=NEW.category
    AND measured_at>=NEW.created_at-120000 AND reduction<>'paused'
    AND (reduction='normal' OR NOT EXISTS(SELECT 1 FROM engine_publications p
      WHERE p.category=NEW.category AND p.created_at>=NEW.created_at-NEW.created_at%86400000)))
    THEN RAISE(ABORT,'engine_activity_hold') END;
END;

DROP TRIGGER engine_action_guard;
CREATE TRIGGER engine_action_guard BEFORE INSERT ON engine_actions BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM engine_config c,engine_runtime r,engine_accounts a,users actor,users target,engine_preferences p
    WHERE c.id=1 AND r.id=1 AND c.mode='dry-run' AND json_extract(r.profile,'$.enabled')=1
      AND json_extract(r.profile,'$.mode')='automatic'
      AND a.id=NEW.account_id AND a.status='enabled' AND a.visibility='public'
      AND json_extract(a.profile,'$.automation.schedule.enabled')=1
      AND json_extract(a.profile,CASE
        WHEN NEW.kind='follow' THEN '$.automation.permissions.follow'
        WHEN NEW.kind='reaction' THEN '$.automation.permissions.like'
        WHEN NEW.parent_comment_id IS NOT NULL THEN '$.automation.permissions.reply'
        ELSE '$.automation.permissions.comment' END)=1
      AND actor.id=NEW.actor_id AND actor.is_virtual=1 AND actor.engine_account_id=a.id
      AND target.id=NEW.target_id AND target.is_virtual=0 AND target.is_private=0 AND target.id=p.user_id
      AND p.show_virtual_content=1
      AND CASE NEW.kind WHEN 'follow' THEN p.allow_virtual_follows
        WHEN 'reaction' THEN p.allow_virtual_likes ELSE p.allow_virtual_replies END=1
      AND json_extract(r.profile,CASE
        WHEN NEW.kind='follow' THEN '$.followsEnabled'
        WHEN NEW.kind='reaction' THEN '$.reactionsEnabled'
        WHEN NEW.parent_comment_id IS NOT NULL THEN '$.repliesEnabled'
        ELSE '$.commentsEnabled' END)=1
      AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE
        (b.owner_id=actor.id AND b.blocked_id=target.id) OR (b.owner_id=target.id AND b.blocked_id=actor.id))
      AND (NEW.kind='follow' OR EXISTS(SELECT 1 FROM posts p WHERE p.id=NEW.post_id
        AND p.author_id=target.id AND p.visibility='public'))
      AND (NEW.parent_comment_id IS NULL OR EXISTS(SELECT 1 FROM post_comments parent
        WHERE parent.id=NEW.parent_comment_id AND parent.post_id=NEW.post_id
          AND parent.user_id=target.id AND parent.parent_id IS NULL))
      AND EXISTS(SELECT 1 FROM engine_activity h WHERE h.category=a.category AND h.reduction='normal'
        AND h.measured_at>=NEW.created_at-120000)
  ) THEN RAISE(ABORT,'engine_action_ineligible') END;
  SELECT CASE WHEN (SELECT count(*) FROM engine_actions WHERE created_at>=NEW.created_at-NEW.created_at%86400000)>=
    (SELECT json_extract(profile,'$.dailyActionLimit') FROM engine_runtime WHERE id=1)
    OR (SELECT count(*) FROM engine_actions WHERE account_id=NEW.account_id
      AND created_at>=NEW.created_at-NEW.created_at%86400000)>=
      (SELECT json_extract(profile,'$.automation.schedule.maxActionsPerDay')
        FROM engine_accounts WHERE id=NEW.account_id)
    OR EXISTS(SELECT 1 FROM engine_actions WHERE target_id=NEW.target_id AND created_at>=NEW.created_at-604800000)
    OR EXISTS(SELECT 1 FROM engine_actions WHERE account_id=NEW.account_id AND created_at>=NEW.created_at-NEW.created_at%86400000)
    OR EXISTS(SELECT 1 FROM engine_actions WHERE created_at>=NEW.created_at-3600000)
    THEN RAISE(ABORT,'engine_action_quota') END;
END;
