# Oldtime

Existing social PWA imported from `oldtimemessenger/OldtimeAws` for production-readiness repairs. Preserve its existing design and functionality; do not rebuild it as a new demo.

## Run & Operate

- Managed services: `artifacts/api-server: API Server` and `artifacts/oldtimehive: web`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Cloudflare schema changes use additive D1 migrations in `artifacts/api-server/migrations/`.
- Production data/API runtime: Cloudflare Pages, Worker, D1, and R2. The
  production API is the Worker entrypoint in `artifacts/api-server/wrangler.toml`.
- Replit may run `artifacts/api-server/scripts/cloudflare-preview-gateway.mjs`
  as a thin relay to Cloudflare when its public URL must remain available. The
  relay has no database or media store; Cloudflare remains the source of truth.
- Cloudflare is the only application backend. Do not introduce another database,
  storage provider, or fallback service. The retired backend code and credentials
  have been removed. Preserve current Cloudflare records.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Cloudflare Workers (`artifacts/api-server/src/cloudflare/worker.ts`)
- Data and media: Cloudflare D1 and R2
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: Vite frontend and Wrangler Worker bundle

## Where things live

- Canonical release artifact and source: `artifacts/oldtimehive`. Its
  `app/release-entry.js` loads the approved release implementation in its own
  `app/` directory. The former Technologies address redirects to Oldtime;
  it is not a second app. Preserve all current release options. Unreleased
  older source is preserved in `archive/oldtime-deferred/app/`, outside the
  served app, for features the user introduces later. React `src/` is inactive.
- API: `artifacts/api-server/src/cloudflare/`; schema: ordered D1 SQL migrations in `artifacts/api-server/migrations/`.
- Current evidence and pending changes: `docs/current-validation.md`.
- Wider launch blockers: `docs/production-readiness.md`.

## Architecture decisions

The user selected Cloudflare as the production platform: Pages for the web app,
Workers for the API, D1 for relational data, and R2 for media. Do not route
production API calls through any alternative backend service.
Keep existing legacy data untouched; do not import or delete it without new
explicit direction. Do not change DNS or publish without approval.

## Product

Social feed, creative tools, stories, communities and chat. Uploaded media must
be confirmed in Cloudflare before publishing. Browser stores are preserved only
as verified legacy recovery sources; transient work and shell caches are not
the permanent source of uploaded content. Appearance alone is not evidence of
multi-user delivery.

## User preferences

The user requested a finished app for real live users, with no false claims about completion. Never describe a passing build or rendered screen as production certification.

## Gotchas

Run the API tests only against an isolated development/test database: they create and remove disposable fixtures. Historical validation claims in imported documentation are not fresh evidence. No production release has been approved.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Cloudflare Pages setup and its API-origin release gate: `docs/cloudflare-pages.md`.
