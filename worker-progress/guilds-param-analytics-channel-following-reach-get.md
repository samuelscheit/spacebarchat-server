# guilds-param-analytics-channel-following-reach-get

## Goal

- Worker status: goal achieved.
- Objective: Implement production-ready GET support for `/guilds/{guild_id}/analytics/channel-following/reach` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.

## Summary

Implemented `GET /guilds/{guild_id}/analytics/channel-following/reach` for the assigned route only.

The route now:

- Registers `VIEW_GUILD_INSIGHTS` route metadata with common guild analytics query params: `start`, `end`, `interval`.
- Validates analytics query params with the accepted channel-following analytics parser.
- Verifies the target guild exists before returning a response.
- Returns a conservative empty analytics array because Spacebar does not persist Discord's per-announcement channel-following reach aggregates yet.
- Exposes and validates `GuildChannelFollowingReachResponse` with documented reach bucket fields.

## Assigned Scope

- Assigned path: `/guilds/{param}/analytics/channel-following/reach`
- Owned method: `GET`
- Current-base missing count moved from 698 to 697; implemented route count moved from 482 to 483.
- Worker-base missing entries found before implementation: one
    - `GET /guilds/{param}/analytics/channel-following/reach`
    - route name `GET_GUILDS_GUILD_ID_ANALYTICS_CHANNEL_FOLLOWING_REACH`
    - source `userdoccers:resources/guild-analytics.mdx`
- Confirmed absent before implementation:
    - No matching entry in `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`.
    - No matching `src/api/routes/**` implementation for `channel-following/reach`.

## References Used

- Userdoccers guild analytics docs: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild-analytics.mdx`
    - Common query params: `start`, `end`, `interval`.
    - Aggregation interval values: `0`, `1`, `2`, `3`.
    - Channel following reach fields: `day_pt`, `channel_id`, `channel_name`, `reference_message_id`, `guilds_reached`.
- Local accepted route patterns:
    - `src/api/routes/guilds/#guild_id/analytics/channel-following/overview.ts`
    - `src/api/routes/guilds/#guild_id/analytics/channel-following/query.ts`
    - `test/routes/guilds-param-analytics-channel-following-overview-get.test.ts`
- xHyroM references: not used; Userdoccers and local accepted analytics routes were sufficient.

## Changed Files

- `src/api/routes/guilds/#guild_id/analytics/channel-following/reach.ts`
    - New production route implementation.
- `src/schemas/responses/GuildChannelFollowingReachResponse.ts`
    - New response and bucket types.
- `src/schemas/responses/index.ts`
    - Response schema export.
- `test/routes/guilds-param-analytics-channel-following-reach-get.test.ts`
    - Focused route/schema/generated-artifact test coverage.
- `assets/schemas.json`
    - Regenerated schema asset with `GuildChannelFollowingReachResponse`.
- `assets/openapi.json`
    - Regenerated OpenAPI with the new GET path.
- `assets/testing-manifest.json`
    - Regenerated testing manifest with the new route entry.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - Regenerated source route catalog with the new route.
- `packages/missing-routes/missing.json`
    - Regenerated missing-route report.
- `test/generated/http-contracts.json`
    - Regenerated generated HTTP contract catalog.
- `test/generated/suite-coverage.json`
    - Regenerated generated suite coverage.
- `worker-progress/guilds-param-analytics-channel-following-reach-get.md`
    - This handoff report.

## Worker Commands And Evidence

- `jq '.missing_entries | length' packages/missing-routes/missing.json`
    - Worker-base before implementation: `701`.
- `jq '.missing_entries[] | select(.route == "/guilds/{param}/analytics/channel-following/reach")' packages/missing-routes/missing.json`
    - Found one `GET` missing entry.
- `rg -n "channel-following/reach|channel-following" src/api/routes packages/automatic-reverse-engineering/data/catalogs test`
    - Only Userdoccers catalog references existed before implementation.
- `curl -fsSL https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild-analytics.mdx`
    - Confirmed common query params, interval values, and reach response shape.
- `npm run build:src:tsgo`
    - Failed outside this route in the symlinked worker worktree with the known `ChannelMessageCreateRoute.ts` TS2883 portability diagnostic; that file had no local diff.
- `npm run generate:schema`
    - Passed; generated 945 schemas and included `GuildChannelFollowingReachBucket`.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
    - Passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - Passed.
- `npm run build --workspace @spacebar/missing-routes`
    - Passed.
- `npm run start --workspace @spacebar/missing-routes`
    - Passed; `Spacebar is missing 700`.
- `npm run generate:testing-manifest`
    - Passed; wrote 585 entries.
- `node scripts/testing-manifest/verify.js`
    - Passed; `Testing manifest verified (585 entries)`.
- `node scripts/testing-manifest/generate-contract-tests.js --check`
    - Initially stale, as expected after adding a route.
- `npm run generate:contract-tests`
    - Passed; wrote 560 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`
    - Passed; `Generated HTTP contract tests verified (560 contracts)`.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
    - Initially stale, as expected after adding a route.
- `npm run generate:suite-coverage`
    - Passed; wrote 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
    - Passed; `Generated suite coverage verified`.
- `NODE_PRESERVE_SYMLINKS=1 npm run generate:openapi`
    - Passed using the worker worktree's local `dist`; wrote 386 paths and 945 schemas.
- `npm run build:test-fixtures`
    - Passed.
- `NODE_PRESERVE_SYMLINKS=1 node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-analytics-channel-following-reach-get.test.js`
    - Passed on rerun: 6 tests, 6 pass.
- `git diff --check`
    - Passed.
- `git diff -- package.json package-lock.json 'packages/*/package.json' 'packages/*/package-lock.json'`
    - No manifest or lockfile diffs.
- Warranty scan over changed source/test/report files:
    - No malformed warranty spelling variants found.
    - New source/test headers contain `MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the`.

## Current-Base Orchestrator Acceptance Commands

- `tmux capture-pane -pt spacebar-current-guilds-param-analytics-channel-following-reach-get -S -140` -> worker pane showed `Goal achieved`.
- `curl -fsSL https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild-analytics.mdx | rg -n -A25 -B5 "Channel Following Reach|channel-following/reach|guilds_reached|reference_message_id"` -> verified route summary, common query params, and documented response fields.
- `npm run build:src:tsgo` -> passed on the current server integration branch.
- `npm run generate:schema` -> passed; wrote 951 schemas.
- `npm run build:test-fixtures` -> passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` -> passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` -> passed.
- `npm run build --workspace @spacebar/missing-routes` -> passed.
- `npm run start --workspace @spacebar/missing-routes` -> passed; `Spacebar is missing 697`, `Spacebar implements 483`, `Discord implements 1128`.
- `npm run generate:testing-manifest` -> passed; 588 entries.
- `node scripts/testing-manifest/verify.js` -> passed; 588 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check` -> initially stale.
- `npm run generate:contract-tests` -> passed; 563 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` -> passed; 563 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` -> initially stale.
- `npm run generate:suite-coverage` -> passed; 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` -> passed.
- `npm run generate:openapi` -> passed; 389 paths and 951 schemas.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-analytics-channel-following-reach-get.test.js` -> passed; 6 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` -> passed; 13 tests.
- `node scripts/testing-manifest/verify.js && node scripts/testing-manifest/generate-contract-tests.js --check && node scripts/testing-manifest/generate-suite-coverage.js --check` -> passed.
- `npx eslint 'src/api/routes/guilds/#guild_id/analytics/channel-following/reach.ts' src/schemas/responses/GuildChannelFollowingReachResponse.ts test/routes/guilds-param-analytics-channel-following-reach-get.test.ts src/schemas/responses/index.ts` -> passed.
- `npx prettier --check 'src/api/routes/guilds/#guild_id/analytics/channel-following/reach.ts' src/schemas/responses/GuildChannelFollowingReachResponse.ts test/routes/guilds-param-analytics-channel-following-reach-get.test.ts src/schemas/responses/index.ts worker-progress/guilds-param-analytics-channel-following-reach-get.md` -> initially found formatting drift in the route test and report.
- `npx prettier --write test/routes/guilds-param-analytics-channel-following-reach-get.test.ts worker-progress/guilds-param-analytics-channel-following-reach-get.md` -> passed.

## Risks And Blockers

- The worker worktree hit a symlink-specific `npm run build:src:tsgo` portability error in `src/api/util/handlers/ChannelMessageCreateRoute.ts`. The current server integration branch did not reproduce it; current-base `npm run build:src:tsgo` passed.
- The route returns an empty list until Spacebar persists Discord-equivalent channel-following reach analytics. This matches nearby accepted analytics endpoints that avoid fabricating private analytics aggregates.

## Recommended Next Tasks

- Continue adjacent channel-following routes only through their assigned workers; this worker did not implement overview or other channel-following endpoints.

## Completion Audit

- Derived every current `missing_entries[]` item for the assigned path: complete.
- Confirmed owned method absent in source catalog and route tree before implementation: complete.
- Compared local route catalogs and Userdoccers docs only as needed: complete.
- Implemented production behavior for assigned `GET`: complete.
- Added focused tests for route behavior, schema validation, generated artifacts, and missing-route removal: complete.
- Regenerated source route catalog: complete.
- Regenerated missing-route report: complete.
- Regenerated testing manifest: complete.
- Regenerated generated HTTP contracts: complete.
- Regenerated generated suite coverage: complete.
- Regenerated schemas: complete.
- Regenerated OpenAPI: complete with worker symlink preservation due aliasing.
- Ran required verification and captured failures/blockers: complete.
- Scoped package manifest/lockfile cleanliness check: complete.
- Malformed warranty-string scan: complete.
- Did not use `git stash`, did not push, and did not implement adjacent routes.

## Goal Evidence

- `create_goal` was called first with the assigned objective.
- `get_goal` returned status `active` for the assigned objective and was recorded at the start of the worker report.
- Worker pane showed `Goal achieved` after `update_goal(status: "complete")`.
