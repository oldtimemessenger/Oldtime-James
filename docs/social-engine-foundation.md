# Oldtime Intelligent Social Engine — foundation design record

> This document records the original foundation stage; it is not the current runtime specification. See [social-engine-runtime.md](social-engine-runtime.md) for the current implementation, verification status and production gates. Both engine configuration and any production migration must remain explicitly paused until an authorized release.

## Scope and release gate

The foundation migration established additive storage and limits. The later runtime implementation adds publishing, review and participation capabilities in server code, all disabled by default. Bootstrap creates up to 10 starter editorial profiles, not 200 provisioned users or AI processes. Existing people, media, posts, messages, sessions and drafts are not changed.

The master configuration remains `paused` by default; account content uses review and opt-in runtime settings. Activating automation requires an authorized administrator. Never treat the feature code or its tests as production activation.

Migration `0014_social_engine_foundation.sql` is additive. Do not run it remotely without release authorization. The deferred `0011` cleanup remains outside the active migration directory and must not be executed.

## Reused infrastructure

- Same Cloudflare Worker, D1 database, authentication and existing creator administrator authority.
- Same account settings and Creator Center navigation, with authenticated vanilla-JavaScript controls.
- Same existing daily maintenance cron: a paused configuration adds one indexed config lookup to that invocation. There are no 200 timers or new continuously running services.
- Existing shared deterministic discovery classifier and feed ranking remain unchanged.

The active release uses the Cloudflare Worker and the Pages API service binding; do not create another backend for this engine.

## Controls and data

Administrators enter through Creator Center → Tools → Social Engine, or Creator admin → Social Engine. Server authorization is checked independently of hidden menu links.

- Revision-checked configuration: mode, monthly AI limit (0–500 US cents), daily planned intentions (0–40) and planning batches (0–10).
- Personality configurations: handle, name, bio, avatar reference, category, explicit interests, preferred communities, writing style, tone, perspective, locale, visibility and status.
- Statuses: enabled, paused, retired. Enabled means eligible **for planning only**. Retirement is terminal and preserves all records. Retired configurations still occupy a historical registry slot.
- The transparent automation label is server-owned and cannot be hidden using privacy controls. These configurations are not yet public profiles and cannot sign in.
- Source metadata: URL, type, category, authorization/rights notes and draft/approved/revoked status. Approval is an administrator's recorded decision, **not** evidence that a feed is reachable, licensed for every use or factually verified.
- Personal preferences in Settings → Virtual accounts: virtual follows and replies default to disallowed; visibility is opt-out. Participation checks are enforced server-side.
- Budget ledger, last 50 audit entries and last 50 planning jobs. API result sizes, registry capacities and planning quotas are bounded.

No read endpoint exposes administrator registry data to ordinary users. No endpoint can attach a configuration to a human user or accept a caller-supplied billing charge.

## Planning, source controls and costs

The earlier dry-run planner handled held metadata intentions. The runtime adds reviewed content drafts and bounded scheduled operations. A source's administrator-approved status is not independent proof of its terms or copyright.

Each configuration gets at most one intention per UTC day. Batch requests are idempotent. Daily limits include cancelled plans, so pausing/retrying cannot regenerate quota. Global pause, retirement, account edits and source edits/revocation cancel affected held intentions. History is retained. No source is fetched and no content is generated.

Source and avatar references must be public-form HTTPS URLs, without credentials, explicit ports, IP literals, query parameters or fragments. The future source fetcher must also resolve and reject private/reserved addresses, revalidate every redirect and enforce response-size/time limits. Merely accepting a URL now is not sufficient SSRF protection for future fetching.

The approved AI limit is **$5/month**. Amounts in the ledger are integer micro-US dollars ($1 = 1,000,000), avoiding fractional-cent rounding.

- A server-only ledger primitive atomically reserves worst-case cost before a future provider call. It is not exposed over HTTP and does not grant permission to execute.
- Duplicate idempotency keys cannot reserve twice, including across UTC month boundaries.
- An ambiguous provider timeout must retain its reservation until reconciled. Release is only for confirmed non-execution.
- Settlement records actual cost. A charge above its estimate is never hidden: it pauses the configuration and is audited.
- A lower configured cap blocks new reservations without removing prior costs or holds.

The earlier stage had no generation expenditure. The runtime reserves estimated generation cost before a configured Cloudflare AI request; a live inference has not been verified. This application limit does not control unrelated Cloudflare usage.

Current stage adds small D1 metadata storage/writes only, and does not increase cron frequency. The 15-minute scheduler discussed in the initial plan is deliberately deferred. Cloudflare Queues are evaluated for stage 2, not provisioned unnecessarily now. On Workers Paid, current documentation includes 1 million Queue operations/month; ordinary delivery generally needs three operations per small message, plus retries. Included usage is shared with the rest of the app.

No paid source subscription, AI model, image/video generation, new backend, vector database or additional media copy is introduced.

## Gates carried into the current runtime

1. Validate each live Cloudflare source, its rights, facts and attribution separately; the import adapter does not grant permission to republish.
2. Verify a real, budget-reserved AI request in an isolated approved environment before enabling generation.
3. Keep human activity separate in rankings and analytics. Do not fabricate views, profile visits, video playback or watch time.
4. Keep opt-in, rate-limit, moderation and global-pause protections in force; expand beyond the 10-profile pilot only after content quality and operating costs are measured.

Stars coverage is attributed editorial/fan discussion, not celebrity impersonation, invented endorsement or copied media. Personality must not fabricate attendance, personal experiences, quotes, results or breaking news.

## Verification

The foundation tests exercise the additive migration and initial storage. See the runtime specification for later tests and gates. Unit tests alone do not prove live provider access, actual inference, production migrations or launch readiness.
