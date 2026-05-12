# GET /guilds/{param}/requests

## Summary

Implemented `GET /guilds/{guild_id}/requests` only.

Spacebar does not currently have a durable Discord-style guild join request queue model, so the route verifies bearer auth, requires `MANAGE_GUILD`, checks that the guild exists, and returns the locally truthful empty array `[]`.

## Source Evidence

- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` has `GET /guilds/{guild_id}/requests` from `userdoccers:resources/guild.mdx` with summary `Get Guild Join Requests`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` has `GET /guilds/{guild_id}/requests` as `GUILD_JOIN_REQUESTS`.
- Local source search found no durable join request entity or queue. Existing gateway READY fixtures expose `guild_join_requests: []`, which supports an empty local representation until persistence exists.

## Changed Files

- `src/api/routes/guilds/#guild_id/requests.ts`
- `src/schemas/responses/GuildJoinRequestsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-param-requests-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Missing Route Movement

- Before: `missing: 586`, `spacebar: 594`.
- After: `missing: 585`, `spacebar: 595`.
- Removed only `GET /guilds/{param}/requests` from `packages/missing-routes/missing.json`.

Adjacent routes intentionally remain missing:

- `GET /guilds/{param}/requests/@me`
- `GET /guilds/{param}/requests/@me/cooldown`
- `PATCH /guilds/{param}/requests`
- `PATCH /guilds/{param}/requests/{param}`
- `PATCH /guilds/{param}/requests/id/{param}`
- `POST /guilds/{param}/requests/@me`
- `DELETE /guilds/{param}/requests/@me`
- `GET /join-requests/{param}`

## Verification

Commands run with `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

- `npm ci` because this worktree had no `node_modules`.
- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed.
- `npm run generate:openapi` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed.
- `npm run generate:testing-manifest` - passed.
- `npm run generate:contract-tests` - passed.
- `npm run generate:suite-coverage` - passed.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-requests-get.test.js` - passed.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node --test test/generated/http-contracts.test.js` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/suite-coverage.test.js` - passed.
- `npm run test:contracts` - failed only on the known unrelated runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`; generated contract matrix checks passed before runtime.
- `git diff --check` - passed.
- Package/lockfile guard: `git diff -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json apps/admin-dashboard/package.json` was empty.

## Behavioral Risks

- Administrators receive an empty list until Spacebar persists guild join requests. This avoids fabricating requester profiles, approval state, screening state, or Discord-managed join request metadata.
- Route-level `MANAGE_GUILD` permission behavior follows nearby local guild management endpoints; lack of permission returns 403 before the route performs its injected guild lookup.

## Reconciliation

No merge/rebase/reconciliation was performed per worker rules. The branch remains on the assigned worker base; root integration should reconcile if current main has advanced from `be3264abf`.

## Integration Acceptance

Accepted on current integration base `eb12dfc5b`.

- Ported only the worker-owned route, schema, focused test, and progress report. Shared artifacts were regenerated on current main.
- Current-base missing-route movement: `584 -> 583` missing, `596 -> 597` implemented, `1128` Discord.
- Verification passed: `npm run build:src:tsgo`, `npm run generate:schema`, `npm run generate:openapi` (`488` paths / `1130` schemas), automatic reverse-engineering build/import, missing-route regeneration, testing manifest generation/verification (`702` entries), generated contract regeneration/checks (`677` contracts), suite coverage generation/check, `npm run build:test-fixtures`, focused guild-requests route tests (`8/8`), generated contract tests (`10/10`), suite coverage tests (`4/4`), `npm run test:manifest` (`30/30`), ESLint on changed source/test files, `git diff --check`, and package/lockfile guard.
- Full `npm run test:contracts` was run; it failed only on the known unrelated runtime baseline `api:http:GET:/discovery/search` returning `500` instead of `200`. Existing analytics `query.ts` route-registration warnings remain unrelated baseline noise.
