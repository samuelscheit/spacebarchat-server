# GET /guilds/{param}/requests/@me

## Summary

Implemented only `GET /guilds/{guild_id}/requests/@me`.

Spacebar still has no durable Discord-style guild join request queue or current-user guild join request model. The route is bearer-authenticated, verifies the guild exists, and returns `204` with no body when no local current-user join request state exists. It does not require `MANAGE_GUILD`, because the route is for the authenticated user's own join request rather than the guild moderation queue.

## Source Evidence

- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` has `GET /guilds/{guild_id}/requests/@me` from `userdoccers:resources/guild.mdx` with summary `Get Current User Guild Join Request`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` has `GET /guilds/{guild_id}/requests/@me` as `GUILD_MEMBER_REQUEST_TO_JOIN`.
- Nearby local implementation `GET /guilds/{guild_id}/requests` returns the locally truthful empty list because Spacebar does not persist Discord's guild join request queue.
- Local search found no durable join request entity or queue. Existing READY payload support remains `guild_join_requests: []`.

## Changed Files

- `src/api/routes/guilds/#guild_id/requests.ts`
- `test/routes/guilds-param-requests-me-get.test.ts`
- `test/routes/guilds-param-requests-get.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Missing Route Movement

- Before: `missing: 583`, `spacebar: 597`, `discord: 1128`.
- After: `missing: 582`, `spacebar: 598`, `discord: 1128`.
- Removed only the `GET /guilds/{param}/requests/@me` missing entry.

Adjacent routes intentionally remain missing:

- `GET /guilds/{param}/requests/@me/cooldown`
- `DELETE /guilds/{param}/requests/@me`
- `PATCH /guilds/{param}/requests/@me`
- `POST /guilds/{param}/requests/@me`
- `PUT /guilds/{param}/requests/@me`
- `PATCH /guilds/{param}/requests`
- `PATCH /guilds/{param}/requests/{param}`
- `PATCH /guilds/{param}/requests/id/{param}`
- `GET /join-requests/{param}`
- `POST /join-requests/{param}/interview`
- Member verification, onboarding, and new-member-action routes.

## Verification

Commands run with `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

- `npm ci` - passed; this worktree had no `node_modules`.
- `npm run build:src:tsgo` - passed.
- `npm run generate:openapi` - passed; OpenAPI now has 489 paths / 1130 schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run generate:testing-manifest` - passed; 703 entries.
- `npm run start --workspace @spacebar/missing-routes` - passed; 582 missing / 598 implemented.
- `npm run generate:contract-tests` - passed; 678 contracts.
- `npm run generate:suite-coverage` - passed; 15 suites.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-requests-get.test.js dist-test/test/routes/guilds-param-requests-me-get.test.js` - passed; 13/13 focused route tests.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node --test test/generated/http-contracts.test.js` - passed; 9/9.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/suite-coverage.test.js` - passed; 4/4.
- `npm run test:manifest` - passed; 30/30 and manifest verify.
- `npm run test:contracts` - generated contract matrix passed, then failed only on the known unrelated runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`. Existing analytics `query.ts` route-registration warnings also appeared as unrelated baseline noise.
- `git diff --check` - passed.
- Package/lockfile guard: `git diff -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json apps/admin-dashboard/package.json` was empty.

## Behavioral Risks

- The route returns `204` until Spacebar persists current-user guild join requests. This avoids fabricating approval state, screening state, requester profiles, cooldowns, or Discord-managed join request metadata.
- The route only validates guild existence before returning absent state. That preserves access for a current user who may not yet be a guild member because they are checking their own pending join request.

## Reconciliation

No commit, merge, rebase, reset, or stash was performed. The branch remains on the assigned worker base; root integration should reconcile if current main has advanced.

## Integration Acceptance

Accepted into the main server checkout on top of `995f3e0ed` (`Implement stream preview route`).

Current-base movement:

- Before: `missing: 581`, `spacebar: 599`, `discord: 1128`.
- After: `missing: 580`, `spacebar: 600`, `discord: 1128`.
- Removed only `GET /guilds/{param}/requests/@me`.

Current-base verification with `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

- `npm run build:src:tsgo` - passed.
- `npm run generate:openapi` - passed; pre-existing webhook route metadata warnings remained.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; 580 missing / 600 implemented.
- `npm run generate:testing-manifest` - passed; 705 entries.
- `npm run generate:contract-tests` - passed; 680 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js` - passed; 15 suites.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-requests-get.test.js dist-test/test/routes/guilds-param-requests-me-get.test.js` - passed; 13/13 focused route tests.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node --test test/generated/http-contracts.test.js` - passed; 9/9.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/suite-coverage.test.js` - passed; 4/4.
- `npm run lint` - passed.
- `git diff --check` - passed.
- Package/lockfile guard was empty.
- `npm run test:contracts` - generated checks passed, then failed only on the known unrelated runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`; existing analytics `query.ts` route-registration warnings remained baseline noise.
