-- Additive only. No historical accounts, posts, media, messages or drafts are removed.
ALTER TABLE users ADD COLUMN is_virtual INTEGER NOT NULL DEFAULT 0 CHECK(is_virtual IN(0,1));
ALTER TABLE users ADD COLUMN engine_account_id TEXT REFERENCES engine_accounts(id);
CREATE UNIQUE INDEX users_engine_account ON users(engine_account_id) WHERE engine_account_id IS NOT NULL;
CREATE TRIGGER virtual_session_denied BEFORE INSERT ON sessions
WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND is_virtual=1)
BEGIN SELECT RAISE(ABORT,'virtual_login_denied'); END;

CREATE TABLE engine_runtime(
  id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL DEFAULT 1,
  profile TEXT NOT NULL CHECK(json_valid(profile)),lease_key TEXT,lease_until INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,ai_failures INTEGER NOT NULL DEFAULT 0,last_error TEXT,last_run_at INTEGER
);
INSERT INTO engine_runtime(id,profile) VALUES(1,
  '{"enabled":false,"mode":"review","aiEnabled":false,"commentsEnabled":false,"reactionsEnabled":false,"followsEnabled":false,"perAccountDailyLimit":2,"hourlyPostLimit":2,"dailyActionLimit":4,"organicThreshold":10}');
ALTER TABLE engine_preferences ADD COLUMN allow_virtual_replies INTEGER NOT NULL DEFAULT 0 CHECK(allow_virtual_replies IN(0,1));
CREATE TABLE engine_events(
  id TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES engine_sources(id),
  category TEXT NOT NULL,profile TEXT NOT NULL CHECK(json_valid(profile)),revision INTEGER NOT NULL DEFAULT 1,
  fingerprint TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
);
CREATE INDEX engine_events_pending ON engine_events(category,expires_at,created_at);
CREATE TABLE engine_drafts(
  id TEXT PRIMARY KEY,request_key TEXT NOT NULL UNIQUE,event_id TEXT NOT NULL REFERENCES engine_events(id),
  account_id TEXT NOT NULL REFERENCES engine_accounts(id),text TEXT NOT NULL DEFAULT '',fingerprint TEXT UNIQUE,
  status TEXT NOT NULL CHECK(status IN('generating','review','approved','published','rejected','failed')),
  ai_generated INTEGER NOT NULL DEFAULT 0 CHECK(ai_generated IN(0,1)),
  reason TEXT NOT NULL DEFAULT '',source_revision INTEGER NOT NULL,event_revision INTEGER NOT NULL,
  account_revision INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
  UNIQUE(event_id,account_id)
);
CREATE INDEX engine_drafts_pending ON engine_drafts(status,created_at);
CREATE TRIGGER engine_draft_guard BEFORE INSERT ON engine_drafts BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM engine_config c,engine_runtime r,engine_accounts a,engine_events e,engine_sources s
    WHERE c.id=1 AND r.id=1 AND c.mode='dry-run' AND json_extract(r.profile,'$.enabled')=1
      AND a.id=NEW.account_id AND a.status='enabled' AND a.visibility='public' AND a.revision=NEW.account_revision
      AND e.id=NEW.event_id AND e.category=a.category AND e.revision=NEW.event_revision AND e.expires_at>NEW.created_at
      AND s.id=e.source_id AND s.status='approved' AND s.revision=NEW.source_revision)
    THEN RAISE(ABORT,'engine_draft_ineligible') END;
  SELECT CASE WHEN (SELECT count(*) FROM engine_drafts WHERE created_at>=NEW.created_at-NEW.created_at%86400000)>=
    (SELECT daily_post_limit FROM engine_config WHERE id=1)
    OR (NEW.ai_generated=1 AND (SELECT count(*) FROM engine_drafts WHERE ai_generated=1 AND created_at>=NEW.created_at-NEW.created_at%86400000)>=
      (SELECT daily_batch_limit FROM engine_config WHERE id=1))
    OR (SELECT count(*) FROM engine_drafts WHERE account_id=NEW.account_id AND created_at>=NEW.created_at-NEW.created_at%86400000)>=
      (SELECT json_extract(profile,'$.perAccountDailyLimit') FROM engine_runtime WHERE id=1)
    THEN RAISE(ABORT,'engine_draft_quota') END;
END;
CREATE TABLE engine_publications(
  id TEXT PRIMARY KEY,post_id TEXT UNIQUE REFERENCES posts(id) ON DELETE SET NULL,
  draft_id TEXT NOT NULL UNIQUE REFERENCES engine_drafts(id),draft_revision INTEGER NOT NULL,
  event_id TEXT NOT NULL UNIQUE REFERENCES engine_events(id),account_id TEXT NOT NULL REFERENCES engine_accounts(id),
  category TEXT NOT NULL,created_at INTEGER NOT NULL
);
CREATE INDEX engine_publication_time ON engine_publications(created_at);
CREATE INDEX engine_publication_account_time ON engine_publications(account_id,created_at);
CREATE TABLE engine_activity(
  category TEXT PRIMARY KEY,human_posts INTEGER NOT NULL,human_authors INTEGER NOT NULL,
  reduction TEXT NOT NULL CHECK(reduction IN('normal','reduced','paused')),measured_at INTEGER NOT NULL
);
CREATE TABLE engine_cycles(id TEXT PRIMARY KEY,result TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE engine_actions(
  id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES engine_accounts(id),actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_id TEXT REFERENCES users(id) ON DELETE SET NULL,post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,comment_id TEXT,
  kind TEXT NOT NULL CHECK(kind IN('follow','comment','reaction')),body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN('executed','undone')),created_at INTEGER NOT NULL,undone_at INTEGER
);
CREATE INDEX engine_action_time ON engine_actions(created_at);
CREATE INDEX engine_action_recipient_time ON engine_actions(target_id,created_at);
CREATE TABLE engine_source_fetches(source_id TEXT PRIMARY KEY REFERENCES engine_sources(id),fetched_at INTEGER NOT NULL,etag TEXT);

CREATE VIEW organic_post_likes AS SELECT l.* FROM post_likes l JOIN users u ON u.id=l.user_id WHERE u.is_virtual=0;
CREATE VIEW organic_post_comments AS SELECT c.* FROM post_comments c JOIN users u ON u.id=c.user_id WHERE u.is_virtual=0;
CREATE VIEW organic_post_reposts AS SELECT r.* FROM post_reposts r JOIN users u ON u.id=r.user_id WHERE u.is_virtual=0;
CREATE VIEW organic_user_follows AS SELECT f.* FROM user_follows f JOIN users u ON u.id=f.follower_id WHERE u.is_virtual=0;
ALTER TABLE analytics_events ADD COLUMN is_virtual INTEGER NOT NULL DEFAULT 0 CHECK(is_virtual IN(0,1));
CREATE INDEX analytics_events_origin_owner ON analytics_events(owner_id,is_virtual,created_at);
CREATE VIEW organic_analytics_events AS SELECT * FROM analytics_events WHERE is_virtual=0;
CREATE TRIGGER analytics_actor_origin BEFORE INSERT ON analytics_events
WHEN NEW.is_virtual<>coalesce((SELECT is_virtual FROM users WHERE id=NEW.actor_id),0)
BEGIN SELECT RAISE(ABORT,'analytics_actor_origin_mismatch'); END;

-- Gate at the commit boundary, not just before asynchronous AI/network work.
CREATE TRIGGER engine_publication_guard BEFORE INSERT ON engine_publications BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM engine_config c,engine_runtime r,engine_drafts d
    JOIN engine_accounts a ON a.id=d.account_id
    JOIN engine_events e ON e.id=d.event_id JOIN engine_sources s ON s.id=e.source_id
    WHERE c.id=1 AND r.id=1 AND c.mode='dry-run' AND json_extract(r.profile,'$.enabled')=1
      AND d.id=NEW.draft_id AND d.revision=NEW.draft_revision AND d.status='approved' AND d.event_id=NEW.event_id AND d.account_id=NEW.account_id
      AND a.status='enabled' AND a.visibility='public' AND a.revision=d.account_revision
      AND s.status='approved' AND s.revision=d.source_revision AND e.revision=d.event_revision
      AND e.expires_at>NEW.created_at AND json_extract(e.profile,'$.verified')=1
      AND json_extract(e.profile,'$.rightsConfirmed')=1 AND json_extract(e.profile,'$.risk')='routine'
  ) THEN RAISE(ABORT,'engine_publication_ineligible') END;
  SELECT CASE WHEN (SELECT count(*) FROM engine_publications WHERE created_at>=NEW.created_at-3600000)>=
    (SELECT json_extract(profile,'$.hourlyPostLimit') FROM engine_runtime WHERE id=1)
    OR (SELECT count(*) FROM engine_publications WHERE created_at>=NEW.created_at-NEW.created_at%86400000)>=
    (SELECT daily_post_limit FROM engine_config WHERE id=1)
    OR (SELECT count(*) FROM engine_publications WHERE account_id=NEW.account_id AND created_at>=NEW.created_at-NEW.created_at%86400000)>=
    (SELECT json_extract(profile,'$.perAccountDailyLimit') FROM engine_runtime WHERE id=1)
    THEN RAISE(ABORT,'engine_publication_quota') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM engine_activity WHERE category=NEW.category
    AND measured_at>=NEW.created_at-120000 AND reduction<>'paused'
    AND (reduction='normal' OR NOT EXISTS(SELECT 1 FROM engine_publications p
      WHERE p.category=NEW.category AND p.created_at>=NEW.created_at-NEW.created_at%86400000)))
    THEN RAISE(ABORT,'engine_activity_hold') END;
END;
CREATE TRIGGER engine_action_guard BEFORE INSERT ON engine_actions BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM engine_config c,engine_runtime r,engine_accounts a,users actor,users target,engine_preferences p
    WHERE c.id=1 AND r.id=1 AND c.mode='dry-run' AND json_extract(r.profile,'$.enabled')=1
      AND json_extract(r.profile,'$.mode')='automatic'
      AND a.id=NEW.account_id AND a.status='enabled' AND a.visibility='public'
      AND actor.id=NEW.actor_id AND actor.is_virtual=1 AND actor.engine_account_id=a.id
      AND target.id=NEW.target_id AND target.is_virtual=0 AND target.is_private=0 AND target.id=p.user_id
      AND p.show_virtual_content=1 AND CASE NEW.kind WHEN 'follow' THEN p.allow_virtual_follows ELSE p.allow_virtual_replies END=1
      AND json_extract(r.profile,CASE NEW.kind WHEN 'follow' THEN '$.followsEnabled'
        WHEN 'comment' THEN '$.commentsEnabled' ELSE '$.reactionsEnabled' END)=1
      AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE
        (b.owner_id=actor.id AND b.blocked_id=target.id) OR (b.owner_id=target.id AND b.blocked_id=actor.id))
      AND (NEW.kind='follow' OR EXISTS(SELECT 1 FROM posts p WHERE p.id=NEW.post_id
        AND p.author_id=target.id AND p.visibility='public'))
      AND EXISTS(SELECT 1 FROM engine_activity h WHERE h.category=a.category AND h.reduction='normal' AND h.measured_at>=NEW.created_at-120000)
  ) THEN RAISE(ABORT,'engine_action_ineligible') END;
  SELECT CASE WHEN (SELECT count(*) FROM engine_actions WHERE created_at>=NEW.created_at-NEW.created_at%86400000)>=
    (SELECT json_extract(profile,'$.dailyActionLimit') FROM engine_runtime WHERE id=1)
    OR EXISTS(SELECT 1 FROM engine_actions WHERE target_id=NEW.target_id AND created_at>=NEW.created_at-604800000)
    OR EXISTS(SELECT 1 FROM engine_actions WHERE account_id=NEW.account_id AND created_at>=NEW.created_at-NEW.created_at%86400000)
    OR EXISTS(SELECT 1 FROM engine_actions WHERE created_at>=NEW.created_at-3600000)
    THEN RAISE(ABORT,'engine_action_quota') END;
END;
