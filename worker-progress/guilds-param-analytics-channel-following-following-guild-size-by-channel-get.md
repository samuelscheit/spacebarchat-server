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

# guilds-param-analytics-channel-following-following-guild-size-by-channel-get

## Goal

- Worker status: goal achieved.
- Objective: Implement production-ready GET support for `/guilds/{guild_id}/analytics/channel-following/following-guild-size-by-channel` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- Orchestrator acceptance: ported onto current base `89a3eec02` and accepted after current-base regeneration.

## Summary

Implemented `GET /guilds/{guild_id}/analytics/channel-following/following-guild-size-by-channel` for the assigned route only.

The route now:

- Registers `VIEW_GUILD_INSIGHTS` route metadata with common channel-following analytics query params: `start`, `end`, `interval`, plus `channel_id`.
- Extends the shared channel-following analytics parser with optional `channel_id` validation for by-channel analytics routes.
- Accepts `channel_id=0` for all channels and rejects non-snowflake-like values before guild lookup.
- Verifies the target guild exists before returning a response.
- Returns a conservative empty analytics array because Spacebar does not persist Discord's per-channel follower guild-size aggregate buckets yet.
- Exposes and validates `GuildChannelFollowingGuildSizeByChannelResponse` with documented per-channel guild-size bucket fields.

## Assigned Scope

- Assigned path: `/guilds/{param}/analytics/channel-following/following-guild-size-by-channel`
- Owned method: `GET`
- Current-base missing count moved from 695 to 694; implemented route count moved from 485 to 486.
- Worker-base missing entries found before implementation: one
    - `GET /guilds/{param}/analytics/channel-following/following-guild-size-by-channel`
    - route name `GET_GUILDS_GUILD_ID_ANALYTICS_CHANNEL_FOLLOWING_FOLLOWING_GUILD_SIZE_BY_CHANNEL`
    - source `userdoccers:resources/guild-analytics.mdx`
- Confirmed absent before implementation:
    - No matching entry in `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`.
    - No matching `src/api/routes/**` implementation for `channel-following/following-guild-size-by-channel`.

## References Used

- Userdoccers guild analytics docs: `https://docs.discord.food/resources/guild-analytics`
    - Query params: `start`, `end`, `interval`, `channel_id`.
    - Channel following guild-size by-channel fields: `day_pt`, `channel_id`, `guild_size`, `total_guilds_following`.
- Local accepted route patterns:
    - `src/api/routes/guilds/#guild_id/analytics/channel-following/announcements-by-channel.ts`
    - `src/api/routes/guilds/#guild_id/analytics/channel-following/following-guild-size.ts`
    - `src/api/routes/guilds/#guild_id/analytics/channel-following/overview.ts`
    - `src/api/routes/guilds/#guild_id/analytics/channel-following/reach.ts`
    - `src/api/routes/guilds/#guild_id/analytics/channel-following/query.ts`

## Files Changed

- `src/api/routes/guilds/#guild_id/analytics/channel-following/following-guild-size-by-channel.ts`
- `src/api/routes/guilds/#guild_id/analytics/channel-following/query.ts`
- `src/schemas/responses/GuildChannelFollowingGuildSizeByChannelResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-param-analytics-channel-following-following-guild-size-by-channel-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-analytics-channel-following-following-guild-size-by-channel-get.md`

## Current-Base Verification

- `npm run build:src:tsgo` passed.
- `npm run generate:schema` passed and wrote 957 schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed: `Spacebar is missing 694`, `Spacebar implements 486`, `Discord implements 1128`.
- `npm run generate:testing-manifest` passed and wrote 591 entries.
- `node scripts/testing-manifest/verify.js` passed.
- `npm run generate:contract-tests` passed and wrote 566 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` passed.
- `npm run generate:suite-coverage` passed and wrote 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `npm run generate:openapi` passed and wrote 392 paths and 957 schemas.
- `npm run build:test-fixtures` passed.
- Focused route/schema test passed: 7 tests, 0 failures.
- Generated contract/suite matrix passed: 13 tests, 0 failures.
- Focused ESLint passed.
- Focused Prettier check passed.
- `git diff --check` passed.
- Package manifest/lockfile guard passed with no package or lockfile changes.
- Malformed warranty-string scan over changed source/test/report files passed.

## Completion Audit

- Assigned path and method implemented: yes.
- Missing entries derived and documented: yes.
- Local absence confirmed before implementation: yes.
- Userdoccers reference checked: yes.
- Focused tests added and passing: yes.
- Source route catalog regenerated: yes.
- Missing-route report regenerated: yes.
- Testing manifest regenerated and verified: yes.
- Generated HTTP contracts regenerated and verified: yes.
- Generated suite coverage regenerated and verified: yes.
- Schemas regenerated: yes.
- OpenAPI regenerated: yes.
- Diff hygiene, package cleanliness, focused lint, and focused formatting checks: yes.
