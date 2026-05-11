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

# guilds-param-analytics-engagement-text-channels-get

## Goal Evidence

- `create_goal`: status `active`; objective `Implement production-ready support for the missing route path `/guilds/{guild_id}/analytics/engagement/text-channels` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal`: status `active`; objective `Implement production-ready support for the missing route path `/guilds/{guild_id}/analytics/engagement/text-channels` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Final `update_goal(status: "complete")`: status `complete`; time used 503 seconds; tokens used 223,591.

## Assignment

- Worker id: `guilds-param-analytics-engagement-text-channels-get`
- Assigned source path: `/guilds/{guild_id}/analytics/engagement/text-channels`
- Assigned missing-report path: `/guilds/{param}/analytics/engagement/text-channels`
- Missing methods found before implementation: `GET_GUILDS_GUILD_ID_ANALYTICS_ENGAGEMENT_TEXT_CHANNELS` only.
- Methods implemented: `GET /guilds/:guild_id/analytics/engagement/text-channels/`
- Out of scope and untouched: engagement base, overview, muters, voice-channels, pruneable-members, audience analytics, top-games, top-emojis, and adjacent guild routes.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained one owned entry: `GET /guilds/{param}/analytics/engagement/text-channels`, source route `/guilds/{guild_id}/analytics/engagement/text-channels`, source `userdoccers:resources/guild-analytics.mdx`, summary `Get Guild Engagement Text Channels`.
- Current `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` now contains `GET /guilds/{guild_id}/analytics/engagement/text-channels` from `src/api/routes/guilds/#guild_id/analytics/engagement/text-channels.ts` with response refs `APIErrorResponse` and `GuildEngagementTextChannelsResponse`.
- Current `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` confirms Userdoccers source `userdoccers:resources/guild-analytics.mdx` for the same route and route name.
- Userdoccers `pages/resources/guild-analytics.mdx` / `https://docs.discord.food/resources/guild-analytics` documents common `start`, `end`, and `interval` query params, aggregation interval values `0` through `3`, and text-channel engagement buckets with `day_pt`, optional `channel_name`, `channel_id`, `participators`, `communicators`, `messages_sent`, optional `pct_participated_in_channel`, and optional `pct_communicated_in_channel`.
- Existing local analytics routes showed the compatible Spacebar pattern: `VIEW_GUILD_INSIGHTS`, bearer authentication through normal route metadata, explicit `401 APIErrorResponse`, `403`, `404`, conservative empty analytics arrays where durable source-backed analytics aggregates do not exist, and generated artifact assertions in focused tests.

## Behavior

- Added authenticated `GET /guilds/:guild_id/analytics/engagement/text-channels/` route metadata with `VIEW_GUILD_INSIGHTS`.
- Declared responses: `200 GuildEngagementTextChannelsResponse`, explicit `401 APIErrorResponse`, `403 APIErrorResponse`, `404 APIErrorResponse`, and `422 APIErrorResponse`.
- Parses and validates analytics query params:
    - `start` and `end` must be non-empty ISO8601 timestamps when present.
    - `interval` must be one of `0`, `1`, `2`, or `3` when present.
    - `start` must be before or equal to `end` when both are present.
- Looks up the guild by `guild_id` and returns a normal missing-guild error via `Guild.findOneOrFail`.
- Returns `[]` for successful requests because Spacebar does not currently persist Discord's per-channel engagement analytics buckets. No channel activity, counts, timestamps, or percentages are fabricated.
- No gateway events, audit-log entries, persistence writes, or side effects are emitted.

## Schemas

- Added `GuildEngagementTextChannelsResponse = GuildEngagementTextChannelBucket[]`.
- Added `GuildEngagementTextChannelBucket` fields:
    - Required: `day_pt`, `channel_id`, `participators`, `communicators`, `messages_sent`
    - Optional: `channel_name`, `pct_participated_in_channel`, `pct_communicated_in_channel`
- Exported the response from `src/schemas/responses/index.ts`.
- Regenerated `assets/schemas.json` and `assets/openapi.json`.

## Changed Files

- `src/api/routes/guilds/#guild_id/analytics/engagement/text-channels.ts`
- `src/schemas/responses/GuildEngagementTextChannelsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-param-analytics-engagement-text-channels-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-analytics-engagement-text-channels-get.md`

## Generated Artifacts

- `assets/schemas.json`: regenerated; includes `GuildEngagementTextChannelsResponse` and `GuildEngagementTextChannelBucket`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: regenerated; includes the implemented route.
- `packages/missing-routes/missing.json`: regenerated; owned missing entry removed.
- `assets/testing-manifest.json`: regenerated; includes manifest id `api:http:GET:/guilds/:guild_id/analytics/engagement/text-channels/`.
- `test/generated/http-contracts.json`: regenerated after stale check; now 558 contracts.
- `test/generated/suite-coverage.json`: regenerated after stale check; now 15 suites.
- `assets/openapi.json`: regenerated; includes `/guilds/{guild_id}/analytics/engagement/text-channels/` with bearer security and the new response schema.

## Verification

- `npm ci`: passed to hydrate the initially empty `node_modules`; did not change package manifests or lockfiles.
- First `npm run build:src:tsgo`: blocked by missing local dependencies (`Cannot find type definition file for 'node'`) before `npm ci`.
- `npm run build:src:tsgo`: passed after dependency hydration.
- `npm run generate:schema`: passed; wrote 941 schemas.
- `npm run build:test-fixtures`: passed after adding the focused test under `test/routes/**`.
- Focused route/schema test `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-analytics-engagement-text-channels-get.test.js`: passed, 6/6.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; Spacebar missing count is now 702, implements 478, Discord implements 1128.
- `npm run generate:testing-manifest`: passed; wrote 583 entries.
- `node scripts/testing-manifest/verify.js`: passed; verified 583 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale; `npm run generate:contract-tests` regenerated 558 contracts; rerun check passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially stale; `npm run generate:suite-coverage` regenerated 15 suites; rerun check passed.
- Generated matrix tests `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13/13.
- Extra generated runtime auth contracts `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/generated/http-auth-runtime-contracts.test.js`: failed on unrelated public route `api:http:GET:/gifs/suggest/`, which returned `400` where the generated public response-schema contract expected `200`. This failure did not involve the implemented guild analytics route.
- `npm run generate:openapi`: passed; wrote 384 paths and 941 schemas. Existing unrelated warnings remain for webhook routes missing `route()` description middleware.
- `npx eslint src/api/routes/guilds/#guild_id/analytics/engagement/text-channels.ts src/schemas/responses/GuildEngagementTextChannelsResponse.ts src/schemas/responses/index.ts test/routes/guilds-param-analytics-engagement-text-channels-get.test.ts`: passed.
- `npx prettier --check src/api/routes/guilds/#guild_id/analytics/engagement/text-channels.ts src/schemas/responses/GuildEngagementTextChannelsResponse.ts src/schemas/responses/index.ts test/routes/guilds-param-analytics-engagement-text-channels-get.test.ts worker-progress/guilds-param-analytics-engagement-text-channels-get.md`: passed.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no `package.json`, `package-lock.json`, or workspace package manifest changes.
- Changed-file malformed warranty-string scan: passed.

## Missing-Route Count Movement

- Before regeneration from `HEAD:packages/missing-routes/missing.json`: missing entries `703`.
- After regeneration: missing entries `702`.
- Movement: `-1` missing entry; the owned `GET /guilds/{param}/analytics/engagement/text-channels` entry was removed.

## Risks And Next Tasks

- The route currently has no source-backed successful analytics data path beyond an empty compatible response because Spacebar does not persist per-text-channel engagement aggregates.
- A future analytics-storage task should add durable channel engagement rollups and replace `createGuildEngagementTextChannelsResponse()` with a persistence-backed resolver.
- Adjacent guild analytics routes remain missing and were intentionally left for separate assignments.
- The unrelated generated runtime contract failure for `/gifs/suggest/` should be handled outside this worker's route scope.
