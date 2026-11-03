# Deferred Cloudflare D1 migrations

`0011_clear_legacy_create_drafts.sql` is intentionally outside Wrangler's
configured `migrations/` directory. It must not run automatically: it deletes
legacy draft records. Preserve this SQL for audit history, and do not move it
back into the active migration directory without explicit user authorization.
