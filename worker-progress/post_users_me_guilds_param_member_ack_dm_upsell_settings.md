# post_users_me_guilds_param_member_ack_dm_upsell_settings

## Summary

Implemented `POST /users/@me/guilds/{guild_id}/member/ack-dm-upsell-settings`.

The route:

- Requires normal bearer authentication through the route default middleware.
- Looks up the current user's `Member` row for the target guild and returns the existing 404 behavior when absent.
- Sets the Discord-documented `DM_SETTINGS_UPSELL_ACKNOWLEDGED` guild member flag (`1 << 9`) on `Member.flags`.
- Returns `204` with no response body.
- Emits `GUILD_MEMBER_UPDATE` when the flag is newly added.
- Treats repeat acknowledgements as successful no-ops and does not fabricate a second event when local state is already acknowledged.

## Changed Files

- `src/api/routes/users/@me/guilds/#guild_id/member/ack-dm-upsell-settings.ts`
- `src/api/routes/users/@me/guilds/#guild_id/member.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Assigned Route

- Assigned path: `/users/@me/guilds/{param}/member/ack-dm-upsell-settings`
- Assigned route name: `POST_USERS__ME_GUILDS_GUILD_ID_MEMBER_ACK_DM_UPSELL_SETTINGS`
- Missing methods found: `POST`
- Methods implemented: `POST`
- Sibling routes intentionally untouched:
  - `OPTIONS /users/@me/guilds/{guild_id}/member/ack-dm-upsell-settings` from xHyroM catalog
  - `GET /users/@me/guilds/{guild_id}/member`
  - `/users/@me/guilds/{guild_id}/settings`
  - `/guilds/{guild_id}/members/@me`

## Missing-Route Movement

After replaying into the current main checkout and regenerating the source
catalog and missing report:

- `missing`: `493` -> `492`
- `spacebar`: `687` -> `688`
- `discord`: `1128`

The assigned missing entry was removed from `packages/missing-routes/missing.json`, and `routes.source.catalog.json` now contains:

- `POST /users/@me/guilds/{guild_id}/member/ack-dm-upsell-settings`
- route name `POST_USERS__ME_GUILDS_GUILD_ID_MEMBER_ACK_DM_UPSELL_SETTINGS`
- source `src/api/routes/users/@me/guilds/#guild_id/member/ack-dm-upsell-settings.ts`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained the assigned POST route and route name.
- `routes.source.catalog.json` initially had no matching source route entry.
- `routes.userdoccers.catalog.json` contains the POST route from `userdoccers:resources/guild.mdx`.
- `routes.xhyrom.catalog.json` contains `POST` and sibling `OPTIONS` entries named `DM_SETTINGS_UPSELL_ACK`.
- Userdoccers Guild docs: `https://docs.discord.food/resources/guild`
  - Guild member flag `DM_SETTINGS_UPSELL_ACKNOWLEDGED` is `1 << 9`.
  - Acknowledge DM Settings Upsell Modal adds that member flag, requires guild membership, returns `204`, and fires `GUILD_MEMBER_UPDATE`.
- Existing local persistence support: `Member.flags` exists with a migration and is included in `PublicMemberProjection`.

## Verification Commands

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` - first failed because this worktree had no `node_modules` and `tsgo` was unavailable.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci` - passed; installed from the checked-in lockfile.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` - passed after install, and passed again after the event metadata helper adjustment.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` - passed; OpenAPI now includes the POST route.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/users/@me/guilds/#guild_id/member.test.js'` - passed, 7 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` - passed; wrote `missing 494`, `spacebar 686`, `discord 1128`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` - passed in the worker worktree; current main replay wrote `793` entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js` - passed in the worker worktree; current main replay wrote `768` contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js` - passed; wrote `15` suites.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` - failed only on known unrelated runtime contract `api:http:GET:/discovery/search` with `500 !== 200`; generation, static contract matrix, auth runtime checks, and CDN runtime checks otherwise ran as expected.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint 'src/api/routes/users/@me/guilds/#guild_id/member/ack-dm-upsell-settings.ts' 'src/api/routes/users/@me/guilds/#guild_id/member.test.ts'` - passed.
- `git diff --check` - passed.
- `git diff --name-only -- package.json package-lock.json packages/*/package.json` - no output; package and lockfiles unchanged.
- `rg -n 'MERMER|MERMERCHANTIBILITY|MERCHANTIBILITY' src/api/routes/users/@me/guilds/#guild_id/member src/api/routes/users/@me/guilds/#guild_id/member.test.ts` - no output.

## Risks Or Blockers

- `npm run test:contracts` still has the repo-known unrelated `GET /discovery/search` runtime failure.
- The generated runtime event-emission test group remains skipped by the current harness, but manifest and contract metadata now correctly record `GUILD_MEMBER_UPDATE` for this route.
- No durable-state blocker found; `Member.flags` is already persisted locally.

## Reconciliation Notes

- Replayed the scoped worker changes into main checkout commit `23c63db82`.
- Regenerated source route catalog, missing-route report, testing manifest,
  generated HTTP contracts, suite coverage, and OpenAPI in the main checkout.
- Main checkout verification passed: `build:src:tsgo`, ARE build/import,
  missing-routes build/start, `build:test-fixtures`, focused route test
  (`7/7`), `test:manifest`, `test:suite-coverage`, `test:public-assets`,
  generated contract and suite `--check` commands, targeted ESLint,
  `git diff --check`, package/lockfile guard, and warranty typo scan.
- Main checkout `npm run test:contracts` failed only on the repo-known
  unrelated `api:http:GET:/discovery/search` runtime `500 !== 200` case.
- `node_modules` was created by `npm ci` in the assigned worktree and is ignored.
- No package or lockfile changes were made.
- No commits, pushes, stashes, resets, rebases, or remote changes were made.

## Recommended Next Tasks

- None for the assigned route.
- Separately, the shared generated runtime contract failure for `GET /discovery/search` remains available for its owning worker/task.
