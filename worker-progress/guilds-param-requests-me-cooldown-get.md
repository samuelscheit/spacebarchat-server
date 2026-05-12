# GET /guilds/{param}/requests/@me/cooldown

## Summary

Implemented only `GET /guilds/{guild_id}/requests/@me/cooldown`.

Spacebar still has no durable Discord-style guild join request queue, current-user join request, or current-user join request cooldown store. The route is bearer-authenticated, verifies that the guild exists, and returns the locally truthful cooldown representation `{ "cooldown": 0 }`. It does not require `MANAGE_GUILD`, because this endpoint is scoped to the authenticated user's own join request cooldown.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had `GET /guilds/{param}/requests/@me/cooldown` from `userdoccers:resources/guild.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `GET /guilds/{guild_id}/requests/@me/cooldown` with summary `Get Guild Join Request Cooldown`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists the same route as `GUILD_MEMBER_JOIN_REQUEST_COOLDOWN`.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild.mdx` / `https://docs.discord.food/resources/guild#get-guild-join-request-cooldown`; the response body is a `cooldown` integer in seconds.
- Nearby local route behavior in `src/api/routes/guilds/#guild_id/requests.ts`: `GET /requests` returns an empty list because no join request queue is persisted, and `GET /requests/@me` returns `204` because no current-user join request state is persisted.
- Local search found no durable join request or cooldown entity. Existing READY state only exposes `guild_join_requests: []`.

## Changed Files

- `src/api/routes/guilds/#guild_id/requests.ts`
- `src/schemas/responses/GuildJoinRequestsResponse.ts`
- `test/routes/guilds-param-requests-me-cooldown-get.test.ts`
- `test/routes/guilds-param-requests-get.test.ts`
- `test/routes/guilds-param-requests-me-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Behavior Implemented

- Added `GuildJoinRequestCooldownResponse` schema: object with required integer `cooldown`.
- Added `buildGuildJoinRequestCooldownResponse()` and `getCurrentUserGuildJoinRequestCooldown()`.
- Added `GET /guilds/:guild_id/requests/@me/cooldown` route metadata and handler.
- Handler verifies guild existence via the same repository pattern as adjacent request routes, ignores unsupported private cooldown state, and returns `200` with `{ "cooldown": 0 }`.
- Error surface: `401` through bearer auth, `404` through existing guild lookup failure behavior.

## Missing-Route Movement

- Worker base missing entries: `580`.
- After regeneration: `579`.
- Removed only `GET /guilds/{param}/requests/@me/cooldown`.

## Adjacent Routes Intentionally Untouched

- `GET /guilds/{param}/requests`
- `GET /guilds/{param}/requests/@me`
- `POST /guilds/{param}/requests/@me`
- `PUT /guilds/{param}/requests/@me`
- `PATCH /guilds/{param}/requests/@me`
- `DELETE /guilds/{param}/requests/@me`
- `PATCH /guilds/{param}/requests`
- `PATCH /guilds/{param}/requests/{param}`
- `PATCH /guilds/{param}/requests/id/{param}`
- `POST /guilds/{param}/requests/{param}/ack`
- `GET /join-requests/{param}`
- `POST /join-requests/{param}/interview`
- Member verification, onboarding, and new-member-action routes.

## Commands Run

- `jq '.missing_entries[] | select(.route=="/guilds/{param}/requests/@me/cooldown")' packages/missing-routes/missing.json`
- `rg -n "requests/@me|requests|join request|cooldown|join_request|GuildJoin" ...`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` - initial run failed because this worktree had no installed `tsgo` binary.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci` - passed; installed dependencies from lockfile.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` - passed; rerun again after final edits, passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` - passed; wrote `1132` schemas.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` - passed; wrote `492` paths / `1132` schemas.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` - passed; `Spacebar is missing 579`, `Spacebar implements 601`, `Discord implements 1128`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` - passed; `706` entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` - passed; `681` contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` - passed; `15` suites.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` - passed; rerun after test fix, passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-requests-get.test.js dist-test/test/routes/guilds-param-requests-me-get.test.js dist-test/test/routes/guilds-param-requests-me-cooldown-get.test.js` - initial run exposed a test expectation mismatch (`number` vs generated `integer`), final run passed `20/20`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js` - passed; `706` entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check` - passed; `681` contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js` - passed; `9/9`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/suite-coverage.test.js` - passed; `4/4`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint 'src/api/routes/guilds/#guild_id/requests.ts' src/schemas/responses/GuildJoinRequestsResponse.ts test/routes/guilds-param-requests-get.test.ts test/routes/guilds-param-requests-me-get.test.ts test/routes/guilds-param-requests-me-cooldown-get.test.ts` - passed.
- `git diff --check` - passed.
- `git diff --no-index --check /dev/null test/routes/guilds-param-requests-me-cooldown-get.test.ts` and progress-file equivalent - passed for untracked files.
- `git diff --exit-code -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json apps/admin-dashboard/package.json` - passed; no package or lockfile changes.
- Changed-file malformed warranty-string scan - passed.

## Risks And Notes

- The route returns `0` until Spacebar has durable current-user join request cooldown state. This avoids fabricating Discord-managed cooldown metadata.
- The route only validates guild existence. It does not require guild membership or `MANAGE_GUILD`, matching the self-scoped nature of the adjacent current-user join request route.
- If join request persistence is later added, `getCurrentUserGuildJoinRequestCooldown()` should be replaced with a calculation from persisted request/cooldown state.
- `npm ci` was required because this worktree initially lacked installed dependencies. Package manifests and lockfile remained unchanged.

## Reconciliation

The worktree `HEAD` is `83e2eb36972952debdc9e36974aa39bcdf41ee14`, matching the assigned integration base. No reconciliation was needed against the stated base. The orchestrator should still recheck if main advances before merging.

## Recommended Next Tasks

- Implement durable guild join request persistence before adding mutating current-user or moderation queue routes.
- Assign separate workers for `POST`/`PUT`/`DELETE /guilds/{guild_id}/requests/@me`, moderation queue mutation routes, and `/join-requests/{id}` routes.

## Integration Acceptance

- Integrated on main server branch from base `257aec116`.
- Missing-route movement: `578 -> 577`.
- Implemented-route movement: `602 -> 603`.
- Discord route count remained `1128`.
- Regenerated schemas/OpenAPI, ARE source catalog, missing-route data, testing manifest, contract tests, suite coverage, and test fixtures.
- Focused route tests passed: `20/20` across `guilds-param-requests-get`, `guilds-param-requests-me-get`, and `guilds-param-requests-me-cooldown-get`.
- Generated checks passed: testing manifest verify, contract test check, generated HTTP contract test `9/9`, suite coverage check, generated suite coverage test `4/4`.
- `npm run lint`, `git diff --check`, and package/lockfile guard passed.
- Full `npm run test:contracts` reached the known baseline failure only: `api:http:GET:/discovery/search` returned `500` instead of `200`; analytics `query.ts` route-registration warnings remained baseline noise.
