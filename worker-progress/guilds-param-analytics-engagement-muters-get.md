<!--
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

# Guild Engagement Muters

## Scope

- Assigned route: `GET /guilds/{guild_id}/analytics/engagement/muters`.
- Missing-report form: `GET /guilds/{param}/analytics/engagement/muters`.
- Methods found and implemented for this exact path: `GET` only.
- Out of scope and not implemented: engagement base, text-channels, voice-channels, pruneable-members, overview, audience analytics, growth analytics, channel-following analytics, welcome-screen analytics, and adjacent guild routes.

## Goal And Source Evidence

- Worker `create_goal`: created an active goal for this exact route assignment.
- Worker `get_goal`: returned active status with the same objective.
- Worker `update_goal`: final handoff reported completion after 362 seconds with 218794 tokens.
- `packages/missing-routes/missing.json` listed one owned `GET` entry for this path before the current-base port.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists route `/guilds/{guild_id}/analytics/engagement/muters`, route name `GET_GUILDS_GUILD_ID_ANALYTICS_ENGAGEMENT_MUTERS`, and source `userdoccers:resources/guild-analytics.mdx`.
- Worker checked raw Userdoccers guild analytics docs and reported common query params `start`, `end`, and `interval`, plus muter bucket fields `day_pt`, `days_in_guild`, and `muters`.

## Behavior

- Auth mode: bearer-authenticated route requiring `VIEW_GUILD_INSIGHTS`, with explicit `401`, `403`, and `404` response metadata.
- Query metadata: documents `start`, `end`, and `interval` using the same analytics metadata style as nearby accepted analytics routes.
- Response: `GuildEngagementMutersResponse`, an array of buckets with `day_pt`, `days_in_guild`, and `muters`.
- Data source: returns an empty array until Spacebar has durable/source-backed guild muter analytics, opt-out handling, privacy thresholds, and historical aggregate buckets.

## Accepted Current-Base Changes

- `src/api/routes/guilds/#guild_id/analytics/engagement/muters.ts`
- `src/api/routes/guilds/#guild_id/analytics/engagement/muters.test.ts`
- `src/schemas/responses/GuildEngagementMutersResponse.ts`
- `src/schemas/responses/GuildEngagementMutersResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `assets/openapi.json`
- `worker-progress/guilds-param-analytics-engagement-muters-get.md`

## Current-Base Verification

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; processed 457 schema sources and wrote 939 schemas.
- `npm run build:test-fixtures`: passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed and reported `Spacebar is missing 703`, `Spacebar implements 477`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed and wrote 582 entries.
- `node scripts/testing-manifest/verify.js`: passed with 582 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially reported stale generated contracts, then passed after `npm run generate:contract-tests` wrote 557 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially reported stale suite coverage, then passed after `npm run generate:suite-coverage`.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed 13/13.
- `npm run generate:openapi`: passed and reported 383 paths, 939 schemas, and 3 pre-existing routes missing route middleware.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/guilds/#guild_id/analytics/engagement/muters.test.js' dist-test/src/schemas/responses/GuildEngagementMutersResponse.test.js`: passed 5/5.
- `npx prettier --write 'src/api/routes/guilds/#guild_id/analytics/engagement/muters.ts' 'src/api/routes/guilds/#guild_id/analytics/engagement/muters.test.ts' src/schemas/responses/GuildEngagementMutersResponse.ts src/schemas/responses/GuildEngagementMutersResponse.test.ts src/schemas/responses/index.ts tsconfig.test.json`: passed.
- `npx eslint --concurrency 4 'src/api/routes/guilds/#guild_id/analytics/engagement/muters.ts' 'src/api/routes/guilds/#guild_id/analytics/engagement/muters.test.ts' src/schemas/responses/GuildEngagementMutersResponse.ts src/schemas/responses/GuildEngagementMutersResponse.test.ts`: passed.

## Missing-Route Movement

- Before current-base port: `missing = 704`, `spacebar = 476`, `discord = 1128`.
- After current-base regeneration: `missing = 703`, `spacebar = 477`, `discord = 1128`.
- Owned entry still missing after regeneration: none.

## Risks And Follow-Up

- Clients expecting populated Discord analytics receive an empty list until Spacebar has a durable guild analytics aggregation model. This matches the conservative analytics route pattern already accepted for routes without local historical aggregate storage.
- A future shared analytics data source should handle visitor, opt-out, privacy-threshold, tenure, channel, voice, and historical aggregate semantics before non-empty engagement analytics responses are added.
