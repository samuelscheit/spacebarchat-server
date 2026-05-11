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

# GET /guilds/{guild_id}/analytics/engagement/voice-channels

## Summary

Implemented the missing `GET /guilds/{guild_id}/analytics/engagement/voice-channels` route only.

The route now:

- Requires authenticated bearer access through route metadata.
- Requires `VIEW_GUILD_INSIGHTS`.
- Declares explicit `401`, `403`, `404`, and `422` API error responses.
- Parses common guild analytics query parameters: `start`, `end`, and `interval`.
- Checks that the guild exists before returning.
- Returns a conservative empty array until Spacebar has source-backed per-voice-channel engagement analytics persistence.

No adjacent engagement routes were implemented.

## Goal Evidence

- `create_goal`: created active goal with objective `Implement production-ready support for the missing route path /guilds/{guild_id}/analytics/engagement/voice-channels on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal`: confirmed active status for the same objective before implementation.
- Final `update_goal`: completed. Tool result reported goal status `complete`, `tokensUsed: 228054`, `timeUsedSeconds: 548`, and completion budget report `Goal achieved. Report final budget usage to the user: time used: 548 seconds.`

## Assigned Path

- Assigned path: `/guilds/{guild_id}/analytics/engagement/voice-channels`
- Missing-report path form: `/guilds/{param}/analytics/engagement/voice-channels`
- Missing methods found: `GET`
- Methods implemented: `GET`

## Evidence Used

- `packages/missing-routes/missing.json` initially contained one owned missing entry:
    - `GET /guilds/{param}/analytics/engagement/voice-channels`
    - route name `GET_GUILDS_GUILD_ID_ANALYTICS_ENGAGEMENT_VOICE_CHANNELS`
    - source `userdoccers:resources/guild-analytics.mdx`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no source entry for `/guilds/{guild_id}/analytics/engagement/voice-channels`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` contains:
    - `GET /guilds/{guild_id}/analytics/engagement/voice-channels`
    - summary `Get Guild Engagement Voice Channels`
    - source `userdoccers:resources/guild-analytics.mdx`
- Userdoccers raw source checked:
    - `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild-analytics.mdx`
    - documents common query params `start`, `end`, `interval`
    - documents voice-channel engagement buckets with `day_pt`, `channel_name`, `channel_id`, `participators`, `communicators`, `messages_sent`, and optional percentage fields.
- Existing local pattern used:
    - `src/api/routes/guilds/#guild_id/analytics/engagement/base.ts`
    - `src/api/routes/guilds/#guild_id/analytics/engagement/base.test.ts`

## Behavior

Route source:

- `src/api/routes/guilds/#guild_id/analytics/engagement/voice-channels.ts`

Request handling:

- `parseGuildAnalyticsInsightsQuery(req.query)` validates `start`, `end`, and `interval`.
- Invalid ISO timestamps, repeated query parameters, empty query parameters, unsupported intervals, and `start > end` return `422`.
- The route calls `Guild.findOneOrFail({ where: { id: guild_id }, select: { id: true } })`.
- On valid input and existing guild, the route returns `[]`.

Compatibility behavior:

- Spacebar currently does not persist durable/source-backed per-voice-channel engagement analytics buckets.
- To avoid fabricating analytics, channel activity, buckets, counts, or timestamps, the handler returns an empty list.

## Auth And Permission Model

- Auth mode: bearer.
- Permission metadata: `VIEW_GUILD_INSIGHTS`.
- Route metadata responses:
    - `200: GuildEngagementVoiceChannelsResponse`
    - `401: APIErrorResponse`
    - `403: APIErrorResponse`
    - `404: APIErrorResponse`
    - `422: APIErrorResponse`

## Schemas

Added:

- `src/schemas/responses/GuildEngagementVoiceChannelsResponse.ts`

Generated schema:

- `GuildEngagementVoiceChannelsResponse`: array of `GuildEngagementVoiceChannelBucket`
- Required bucket fields:
    - `day_pt`
    - `channel_name`
    - `channel_id`
    - `participators`
    - `communicators`
    - `messages_sent`
- Optional bucket fields:
    - `pct_participated_in_channel`
    - `pct_communicated_in_channel`
- Optional percentage fields use a `@TJS-type number` alias so generated JSON schema preserves Discord's documented float semantics instead of treating percentages as integer counts.

## Changed Files

Source and tests:

- `src/api/routes/guilds/#guild_id/analytics/engagement/query.ts`
- `src/api/routes/guilds/#guild_id/analytics/engagement/base.ts`
- `src/api/routes/guilds/#guild_id/analytics/engagement/voice-channels.ts`
- `src/api/routes/guilds/#guild_id/analytics/engagement/voice-channels.test.ts`
- `src/schemas/responses/GuildEngagementVoiceChannelsResponse.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`

Generated artifacts:

- `assets/schemas.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `assets/openapi.json`

Report:

- `worker-progress/guilds-param-analytics-engagement-voice-channels-get.md`

## Generated Artifact Evidence

- Source catalog now contains `GET /guilds/{guild_id}/analytics/engagement/voice-channels` with response refs `APIErrorResponse` and `GuildEngagementVoiceChannelsResponse`.
- Missing route entry for `GET /guilds/{param}/analytics/engagement/voice-channels` is removed.
- Testing manifest contains `api:http:GET:/guilds/:guild_id/analytics/engagement/voice-channels/` with bearer auth, `VIEW_GUILD_INSIGHTS`, response statuses `200`, `401`, `403`, `404`, `422`, and query metadata.
- HTTP contracts contain the new route contract.
- Suite coverage includes the new manifest id.
- OpenAPI contains `/guilds/{guild_id}/analytics/engagement/voice-channels/` with bearer security and the declared response schemas.

## Missing Route Count Movement

- Before regeneration: `Spacebar is missing 702`.
- After regeneration: `Spacebar is missing 701`.
- Movement for assigned route: `-1`.

## Commands Run

Setup:

- `npm ci` passed. This was required because the worktree initially had no `node_modules`; no package manifests or lockfiles were modified.

Verification:

- `npm run build:src:tsgo` passed.
- `npm run generate:schema` passed and wrote 943 schemas.
- `npm run build:test-fixtures` passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/guilds/#guild_id/analytics/engagement/voice-channels.test.js` passed, 4 tests.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/guilds/#guild_id/analytics/engagement/base.test.js` passed, 4 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed and reported `Spacebar is missing 701`.
- `npm run generate:testing-manifest` passed.
- `node scripts/testing-manifest/verify.js` passed with 584 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check` passed with 559 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed, 13 tests.
- `npm run generate:openapi` passed, writing 385 paths and 943 schemas. It still reports the pre-existing webhook route middleware warnings.
- `npx eslint ...changed source/schema/test files...` passed.
- `npx prettier --check ...changed source/schema/test files... tsconfig.test.json` passed.

Known verification note:

- The first `npm run build:src:tsgo` attempt failed before dependency install because `node_modules` was absent and TypeScript could not find `@types/node`. After `npm ci`, the command passed.

## Risks

- The route intentionally returns `[]` because Spacebar does not currently have source-backed per-voice-channel engagement analytics storage. This is compatibility behavior, not complete analytics functionality.
- Future durable analytics work should replace `createGuildEngagementVoiceChannelsResponse()` with real aggregation over a persisted analytics source while preserving the response schema and permission model.

## Recommended Next Tasks

- Add durable guild engagement analytics persistence and backfill-safe aggregation primitives.
- Implement adjacent missing analytics endpoints only when assigned separately.
