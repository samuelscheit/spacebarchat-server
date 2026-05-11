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

# Worker Progress: guilds-param-analytics-audience-new-members-by-discord-tenure-get

## Goal Evidence

- `create_goal`: status `active`; objective `Implement production-ready support for the missing route path /guilds/{param}/analytics/audience/new-members-by-discord-tenure on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal`: status `active` with the same objective before implementation.
- `update_goal(status: "complete")`: completed after implementation, regeneration, verification, and handoff report; worker reported `timeUsedSeconds = 633`.

## Initial Research

- Assigned path: `/guilds/{param}/analytics/audience/new-members-by-discord-tenure`.
- Missing methods found: `GET` only.
- Expected missing entry confirmed: `GET_GUILDS_GUILD_ID_ANALYTICS_AUDIENCE_NEW_MEMBERS_BY_DISCORD_TENURE`.
- Source route confirmed in Userdoccers catalog: `/guilds/{guild_id}/analytics/audience/new-members-by-discord-tenure`.
- Current source route catalog initially had no matching `/guilds/{guild_id}/analytics/audience/new-members-by-discord-tenure` or `/guilds/{param}/analytics/audience/new-members-by-discord-tenure` entry.
- Current `src/api/routes/guilds/#guild_id` tree initially had no analytics route subtree.
- Worker base missing-route count before regeneration: `719`.
- Out of scope: adjacent guild analytics audience participator routes, channel-following routes, engagement routes, growth-activation routes, welcome-screen analytics routes, and guild discovery analytics.

## External Source Evidence

- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild-analytics.mdx`.
- Userdoccers semantics: common query params are `start`, `end`, and `interval`; the response is a list of objects with `day_pt`, `tenure`, and `new_members`.
- Userdoccers privacy note: audience and welcome-screen analytics are based on recent guild visitors, exclude users opted out of analytics tracking, and suppress small audience groups. Spacebar has no durable analytics visitor/opt-out aggregation for this route, so implementation must not fabricate buckets.

## Implementation Notes

- Methods implemented: `GET`.
- Route file added under `src/api/routes/guilds/#guild_id/analytics/audience/new-members-by-discord-tenure.ts`.
- Auth mode: bearer-authenticated API route, enforced through normal API authentication plus route metadata `permission: "VIEW_GUILD_INSIGHTS"`.
- Error metadata: explicit `401`, `403`, and `404` responses with `APIErrorResponse`.
- Query metadata: `start`, `end`, and `interval`, matching the Userdoccers common analytics query params.
- Response schema: `GuildAudienceNewMembersByDiscordTenureResponse`, an array of `{ day_pt, tenure, new_members }` buckets.
- Data source: no local durable guild analytics visitor/opt-out/privacy-threshold aggregation exists for this path, so the handler returns an empty typed list rather than inventing audience buckets from current membership rows.
- Focused tests added for route metadata, conservative empty behavior, schema validation, and generated artifact coverage.

## Changed Files

- `src/api/routes/guilds/#guild_id/analytics/audience/new-members-by-discord-tenure.ts`
- `src/api/routes/guilds/#guild_id/analytics/audience/new-members-by-discord-tenure.test.ts`
- `src/schemas/responses/GuildAudienceNewMembersByDiscordTenureResponse.ts`
- `src/schemas/responses/GuildAudienceNewMembersByDiscordTenureResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-analytics-audience-new-members-by-discord-tenure-get.md`

## Worker Verification

- `npm run build:src:tsgo`: passed after adding an incidental `RequestHandler` annotation in `ChannelMessageCreateRoute.ts`; that stale-base change was not ported because the current base builds without it.
- `npm run generate:schema`: passed.
- `npm run build:test-fixtures`: passed.
- Focused route/schema tests: passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; missing-route count moved `719 -> 718`.
- `npm run generate:testing-manifest`: passed; manifest had 567 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale, then passed after `npm run generate:contract-tests`.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially stale, then passed after `npm run generate:suite-coverage`.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed.
- `npm run generate:openapi`: passed in the worker but wrote a suspicious schema-only spec due stale shared dependency symlink behavior; current-base OpenAPI is regenerated by the orchestrator.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness: passed; no package manifest or lockfile diffs.
- Malformed warranty-string scan: passed.

## Worker Generated Evidence

- Source route catalog included `GET /guilds/{guild_id}/analytics/audience/new-members-by-discord-tenure` with response refs `APIErrorResponse` and `GuildAudienceNewMembersByDiscordTenureResponse`.
- `packages/missing-routes/missing.json` no longer listed `/guilds/{param}/analytics/audience/new-members-by-discord-tenure` in `routes` or `missing_entries`.
- Generated HTTP contract for `/guilds/:guild_id/analytics/audience/new-members-by-discord-tenure/` was bearer auth, required `VIEW_GUILD_INSIGHTS`, and recorded `200`, `401`, `403`, and `404` response statuses.
- Generated schema assets included `GuildAudienceNewMembersByDiscordTenureResponse` and `GuildAudienceNewMembersByDiscordTenureBucket`.

## Current-Base Orchestrator Verification

- `npm run build:src:tsgo`: passed without the worker's incidental `ChannelMessageCreateRoute` annotation, so that stale-base change was not ported.
- `npm run generate:schema`: passed and wrote 918 schemas.
- `npm run build:test-fixtures`: passed.
- Initial focused route/schema tests: route behavior, metadata, conservative empty response, and schema validation passed; generated artifact assertion failed before OpenAPI/catalog regeneration, as expected.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed.
- `npm run generate:testing-manifest`: passed and wrote 569 entries.
- `node scripts/testing-manifest/verify.js`: passed with 569 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially reported stale generated HTTP contracts.
- `npm run generate:contract-tests`: passed and wrote 544 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed with 544 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially reported stale suite coverage.
- `npm run generate:suite-coverage`: passed and wrote 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `npm run generate:openapi`: passed and wrote 372 paths / 918 schemas.
- Focused route/schema tests after regeneration: passed, 5 tests.
- `npx eslint src/api/routes/guilds/#guild_id/analytics/audience/new-members-by-discord-tenure.ts src/api/routes/guilds/#guild_id/analytics/audience/new-members-by-discord-tenure.test.ts src/schemas/responses/GuildAudienceNewMembersByDiscordTenureResponse.ts src/schemas/responses/GuildAudienceNewMembersByDiscordTenureResponse.test.ts`: passed.
- `npx prettier --check src/api/routes/guilds/#guild_id/analytics/audience/new-members-by-discord-tenure.ts src/api/routes/guilds/#guild_id/analytics/audience/new-members-by-discord-tenure.test.ts src/schemas/responses/GuildAudienceNewMembersByDiscordTenureResponse.ts src/schemas/responses/GuildAudienceNewMembersByDiscordTenureResponse.test.ts worker-progress/guilds-param-analytics-audience-new-members-by-discord-tenure-get.md`: initially found formatting issues in four source/test files.
- `npx prettier --write src/api/routes/guilds/#guild_id/analytics/audience/new-members-by-discord-tenure.ts src/api/routes/guilds/#guild_id/analytics/audience/new-members-by-discord-tenure.test.ts src/schemas/responses/GuildAudienceNewMembersByDiscordTenureResponse.ts src/schemas/responses/GuildAudienceNewMembersByDiscordTenureResponse.test.ts worker-progress/guilds-param-analytics-audience-new-members-by-discord-tenure-get.md`: passed.
- `npm run build:test-fixtures`: passed after formatting.
- Focused route/schema tests after formatting: passed, 5 tests.
- `npx prettier --check src/api/routes/guilds/#guild_id/analytics/audience/new-members-by-discord-tenure.ts src/api/routes/guilds/#guild_id/analytics/audience/new-members-by-discord-tenure.test.ts src/schemas/responses/GuildAudienceNewMembersByDiscordTenureResponse.ts src/schemas/responses/GuildAudienceNewMembersByDiscordTenureResponse.test.ts worker-progress/guilds-param-analytics-audience-new-members-by-discord-tenure-get.md`: passed.
- `git diff --check`: passed.
- Package manifest/lockfile guard: passed with no package manifest or lockfile changes.
- Malformed warranty-string scan across changed source, test, worker-progress, assets, packages, testing, and manifest files: passed.

## Current-Base Missing-Route Count Movement

- `missing = 717 -> 716`, `spacebar = 463 -> 464`, `discord = 1128`.

## Risks And Follow-Ups

- The endpoint intentionally returns `[]` until Spacebar has a durable analytics data model for guild visitors, opt-out state, privacy thresholds, and historical buckets. This avoids fabricating source-incompatible analytics from current membership rows.
- Adjacent guild analytics routes remain missing and out of scope for this worker.
- Recommended next task: design a shared guild analytics aggregation layer before implementing non-empty responses for audience, engagement, growth-activation, channel-following, or welcome-screen analytics.
