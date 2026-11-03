# Cloudflare release

Oldtime already uses Cloudflare Pages, a private API Worker, D1 and R2. This is not a new static-site handoff and does not require a separately hosted API.

## Existing targets

- Pages project: `oldtimehive`, confirmed through the Cloudflare project list.
- Worker: `oldtime-api`.
- D1: `oldtime-app`.
- R2: `oldtime-media`.
- Pages' `OLDTIME_API` service binding points to the private Worker.
- `functions/api/[[path]].ts` forwards API requests using that binding.

Keep the existing domain routing. A domain being listed on a Pages project does not establish that its DNS attachment is active; do not change DNS as part of an ordinary release.

## Build and checks

From the workspace root:

```sh
pnpm run cloudflare:build
pnpm run test:cloudflare
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run build
```

The frontend output is `artifacts/oldtimehive/dist/public`. The API build is a Wrangler dry run, not a published Worker. Pages Functions are compiled from the workspace `functions/` directory during a Pages release; do not treat the static output folder alone as the complete API deployment.

The browser uses same-origin API paths. Do not add an external API URL, another database backend, or browser-visible credentials. The local API workflow is a thin Cloudflare relay.

## Approved release order

1. Inspect pending additive D1 migrations and preserve existing user records.
2. Apply approved migrations before publishing schema-dependent Worker code.
3. Release the Worker to the existing `oldtime-api` target.
4. Release Pages to the existing `oldtimehive` project, retaining the API service binding and Functions.
5. Verify health, sign-in, feed/discovery, media and comments through the existing live application.

A passing build, dry run, local fixture or applied migration is not evidence that the new application code is live. Record the actual release result separately.
