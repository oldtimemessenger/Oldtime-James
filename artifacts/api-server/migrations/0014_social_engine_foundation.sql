-- Additive, paused foundation only. No user creation, publication, or data cleanup.
CREATE TABLE engine_config (
  id INTEGER PRIMARY KEY CHECK(id=1),
  revision INTEGER NOT NULL DEFAULT 1,
  mode TEXT NOT NULL DEFAULT 'paused' CHECK(mode IN ('paused','dry-run')),
  monthly_ai_budget_cents INTEGER NOT NULL DEFAULT 500 CHECK(monthly_ai_budget_cents BETWEEN 0 AND 500),
  daily_post_limit INTEGER NOT NULL DEFAULT 40 CHECK(daily_post_limit BETWEEN 0 AND 40),
  daily_batch_limit INTEGER NOT NULL DEFAULT 10 CHECK(daily_batch_limit BETWEEN 0 AND 10),
  updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT INTO engine_config(id) VALUES(1);

-- Configurations, not users. Provisioning real virtual identities is a later gate.
CREATE TABLE engine_accounts (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
  profile TEXT NOT NULL CHECK(json_valid(profile)),
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('enabled','paused','retired')),
  visibility TEXT NOT NULL CHECK(visibility IN ('public','private')),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TRIGGER engine_accounts_capacity BEFORE INSERT ON engine_accounts
WHEN (SELECT count(*) FROM engine_accounts)>=200
BEGIN SELECT RAISE(ABORT,'engine_account_capacity'); END;
CREATE TRIGGER engine_accounts_retirement BEFORE UPDATE ON engine_accounts
WHEN OLD.status='retired'
BEGIN SELECT RAISE(ABORT,'engine_account_retired'); END;

CREATE TABLE engine_sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  profile TEXT NOT NULL CHECK(json_valid(profile)),
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','approved','revoked')),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TRIGGER engine_sources_capacity BEFORE INSERT ON engine_sources
WHEN (SELECT count(*) FROM engine_sources)>=50
BEGIN SELECT RAISE(ABORT,'engine_source_capacity'); END;

CREATE TABLE engine_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  allow_virtual_follows INTEGER NOT NULL DEFAULT 0 CHECK(allow_virtual_follows IN (0,1)),
  show_virtual_content INTEGER NOT NULL DEFAULT 1 CHECK(show_virtual_content IN (0,1)),
  updated_at INTEGER NOT NULL
);
CREATE TABLE engine_simulation_runs (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  config_revision INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX engine_runs_day_idx ON engine_simulation_runs(day);
CREATE TRIGGER engine_runs_quota BEFORE INSERT ON engine_simulation_runs
BEGIN
  SELECT CASE WHEN (SELECT mode FROM engine_config WHERE id=1)<>'dry-run'
    THEN RAISE(ABORT,'engine_paused') END;
  SELECT CASE WHEN (SELECT count(*) FROM engine_simulation_runs WHERE day=NEW.day)>=
    (SELECT daily_batch_limit FROM engine_config WHERE id=1)
    THEN RAISE(ABORT,'engine_batch_quota') END;
END;
CREATE TABLE engine_jobs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES engine_simulation_runs(id),
  account_id TEXT NOT NULL REFERENCES engine_accounts(id),
  source_id TEXT NOT NULL REFERENCES engine_sources(id),
  category TEXT NOT NULL,
  day TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'held' CHECK(status IN ('held','cancelled')),
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(day,account_id)
);
CREATE INDEX engine_jobs_day_idx ON engine_jobs(day,created_at);
CREATE INDEX engine_jobs_run_idx ON engine_jobs(run_id);
CREATE INDEX engine_jobs_account_idx ON engine_jobs(account_id,status);
CREATE INDEX engine_jobs_source_idx ON engine_jobs(source_id,status);
CREATE TRIGGER engine_jobs_admission BEFORE INSERT ON engine_jobs
BEGIN
  SELECT CASE WHEN (SELECT mode FROM engine_config WHERE id=1)<>'dry-run'
    THEN RAISE(ABORT,'engine_paused') END;
  SELECT CASE WHEN (SELECT count(*) FROM engine_jobs WHERE day=NEW.day)>=
    (SELECT daily_post_limit FROM engine_config WHERE id=1)
    THEN RAISE(ABORT,'engine_daily_quota') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM engine_accounts a JOIN engine_sources s ON s.id=NEW.source_id
    WHERE a.id=NEW.account_id AND a.status='enabled' AND a.visibility='public'
    AND s.status='approved' AND s.category=a.category AND NEW.category=a.category)
    THEN RAISE(ABORT,'engine_ineligible_plan') END;
END;

-- Integer micro-US dollars: $5 == 5,000,000. No floats or client-reported charges.
CREATE TABLE engine_budget_months (
  month TEXT PRIMARY KEY,
  limit_micro_usd INTEGER NOT NULL CHECK(limit_micro_usd BETWEEN 0 AND 5000000),
  spent_micro_usd INTEGER NOT NULL DEFAULT 0 CHECK(spent_micro_usd>=0),
  reserved_micro_usd INTEGER NOT NULL DEFAULT 0 CHECK(reserved_micro_usd>=0)
);
CREATE TABLE engine_ai_reservations (
  idempotency_key TEXT PRIMARY KEY,
  month TEXT NOT NULL REFERENCES engine_budget_months(month),
  estimate_micro_usd INTEGER NOT NULL CHECK(estimate_micro_usd>0),
  actual_micro_usd INTEGER,
  state TEXT NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','settled','released')),
  created_at INTEGER NOT NULL,
  settled_at INTEGER,
  CHECK((state='reserved' AND actual_micro_usd IS NULL AND settled_at IS NULL) OR
    (state='settled' AND actual_micro_usd IS NOT NULL AND actual_micro_usd>=0 AND settled_at IS NOT NULL) OR
    (state='released' AND actual_micro_usd IS NOT NULL AND actual_micro_usd=0 AND settled_at IS NOT NULL))
);
CREATE INDEX engine_reservations_month_idx ON engine_ai_reservations(month,state);
CREATE TRIGGER engine_budget_admission BEFORE INSERT ON engine_ai_reservations
BEGIN
  SELECT CASE WHEN NEW.state<>'reserved' OR NEW.actual_micro_usd IS NOT NULL OR NEW.settled_at IS NOT NULL
    THEN RAISE(ABORT,'engine_invalid_reservation') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM engine_budget_months WHERE month=NEW.month
    AND spent_micro_usd+reserved_micro_usd+NEW.estimate_micro_usd<=limit_micro_usd)
    THEN RAISE(ABORT,'engine_budget_exhausted') END;
END;
CREATE TRIGGER engine_budget_reserve AFTER INSERT ON engine_ai_reservations
BEGIN
  UPDATE engine_budget_months SET reserved_micro_usd=reserved_micro_usd+NEW.estimate_micro_usd WHERE month=NEW.month;
END;
CREATE TRIGGER engine_budget_immutable BEFORE UPDATE ON engine_ai_reservations
WHEN OLD.state<>'reserved' OR NEW.state='reserved' OR NEW.idempotency_key<>OLD.idempotency_key OR
  NEW.month<>OLD.month OR NEW.estimate_micro_usd<>OLD.estimate_micro_usd OR NEW.created_at<>OLD.created_at
BEGIN SELECT RAISE(ABORT,'engine_reservation_immutable'); END;
CREATE TRIGGER engine_budget_settle AFTER UPDATE ON engine_ai_reservations
BEGIN
  UPDATE engine_budget_months SET reserved_micro_usd=reserved_micro_usd-OLD.estimate_micro_usd,
    spent_micro_usd=spent_micro_usd+NEW.actual_micro_usd WHERE month=NEW.month;
  -- Never hide an unexpected real charge. Record it and stop further automation.
  UPDATE engine_config SET mode='paused',revision=revision+1,updated_at=NEW.settled_at
    WHERE id=1 AND NEW.actual_micro_usd>OLD.estimate_micro_usd;
END;

CREATE TABLE engine_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_id TEXT,
  event_key TEXT UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX engine_audit_time_idx ON engine_audit(created_at DESC,id DESC);
