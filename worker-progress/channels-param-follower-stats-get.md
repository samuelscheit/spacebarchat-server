# GET /channels/{channel_id}/follower-stats

## Summary

Implemented the missing authenticated `GET /channels/{channel_id}/follower-stats` route for announcement channels. The route returns the Discord web client follower stats response keys, using Spacebar's channel-follower webhook state for current counts and zeroes for historical analytics Spacebar does not persist.

Goal evidence: initial `get_goal` reported objective `implement the missing route path GET /channels/{channel_id}/follower-stats for the Spacebar server API` with status `active`; final `get_goal` after completion reported the same objective with status `complete` and time used `808` seconds.

## Changed Files

- `src/api/routes/channels/#channel_id/follower-stats.ts`
- `src/api/routes/channels/#channel_id/follower-stats.test.ts`
- `src/api/util/utility/ChannelFollowers.ts`
- `src/api/util/utility/ChannelFollowers.test.ts`
- `src/schemas/responses/ChannelFollowerStatsResponse.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/channels-param-follower-stats-get.md`

## Assigned Path

- Assigned path: `/channels/{channel_id}/follower-stats`
- Missing route key owned: `/channels/{param}/follower-stats`
- Missing methods found: `GET` / `CHANNEL_FOLLOWER_STATS`
- Methods implemented: `GET`

## Evidence Gathered

- `packages/missing-routes/missing.json` had `GET /channels/{param}/follower-stats`, route name `CHANNEL_FOLLOWER_STATS`, sourced from `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/channels/#channel_id` did not contain the route before implementation.
- Local xHyroM catalog lists `GET`, `HEAD`, and `OPTIONS` for `/channels/{channel_id}/follower-stats`; the missing-routes assignment only owned `GET`.
- Local Userdoccers catalog and upstream Userdoccers `pages/resources/channel.mdx` document adjacent `POST /channels/{channel_id}/followers`, but no `GET /follower-stats` route.
- Discord web client stable build exposed the store fields expected from this response: `channels_following`, `guild_members`, `guilds_following`, `users_seen_ever`, `subscribers_gained_since_last_post`, and `subscribers_lost_since_last_post`.

## What Changed

- Added `ChannelFollowerStatsResponse` schema with the client-confirmed fields.
- Added `GET /channels/:channel_id/follower-stats/` route metadata with `VIEW_CHANNEL` permission and `200`, `400`, `401`, `403`, and `404` response schemas.
- Validates the source channel is a guild announcement channel.
- Computes:
  - `channels_following` from distinct target `channel_id` values on channel-follower webhooks.
  - `guilds_following` from distinct target `guild_id` values.
  - `guild_members` from member rows in distinct following guilds.
  - historical/analytics fields as `0` because Spacebar has no persisted backing state for those metrics.
- Added focused route metadata/handler tests and utility tests.
- Regenerated route source catalog, missing-route report, schema, testing manifest, HTTP contracts, suite coverage, and OpenAPI.

## Missing-Route Movement

- Before: `missing: 846`, `spacebar: 334`
- After regeneration: `missing: 845`, `spacebar: 335`
- `/channels/{param}/follower-stats` was removed from `missing_entries[]`.

## Commands Run

- `if [ -L node_modules ]; then unlink node_modules; fi`
- `if [ ! -d node_modules ]; then npm ci; fi`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/channels/#channel_id/follower-stats.test.js' dist-test/src/api/util/utility/ChannelFollowers.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run generate:suite-coverage`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `git diff --check`
- Malformed AGPL-token scan over changed files.

## Risks Or Blockers

- Exact Discord server-side permission semantics for `follower-stats` were not documented in Userdoccers; this implementation uses conservative authenticated `VIEW_CHANNEL` behavior, matching visibility of the source announcement channel.
- Spacebar does not currently store historical follower analytics, so `users_seen_ever`, `subscribers_gained_since_last_post`, and `subscribers_lost_since_last_post` are compatibility zeros.

## Recommended Next Tasks

- Implement `/channels/{channel_id}/follower-message-stats` separately if assigned; it is intentionally out of scope here.
- Consider adding persistent follower analytics events if Spacebar wants non-zero historical metrics later.
