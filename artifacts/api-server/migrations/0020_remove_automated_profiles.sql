-- Remove the retired generated-profile system and its account data.
-- Public sounds are intentionally retained; sound_library.owner_id uses ON DELETE SET NULL.
DELETE FROM engine_actions;
DELETE FROM engine_publications;
DELETE FROM engine_drafts;
DELETE FROM engine_jobs;
DELETE FROM engine_source_fetches;
DELETE FROM engine_simulation_runs;
DELETE FROM engine_events;
DELETE FROM engine_sources;
DELETE FROM engine_audit;
DELETE FROM engine_preferences;
DELETE FROM engine_cycles;
DELETE FROM engine_activity;
DELETE FROM engine_ai_reservations;
DELETE FROM engine_budget_months;
DELETE FROM engine_runtime;
DELETE FROM engine_config;

DELETE FROM user_follows
WHERE follower_id IN (SELECT id FROM users WHERE is_virtual=1)
   OR followed_id IN (SELECT id FROM users WHERE is_virtual=1);
DELETE FROM account_state WHERE user_id IN (SELECT id FROM users WHERE is_virtual=1);
DELETE FROM users WHERE is_virtual=1;
DELETE FROM engine_accounts;
