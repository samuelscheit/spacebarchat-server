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

# Worker Progress: guilds-param-analytics-audience-participators-by-platform-get

## Goal Evidence

- `create_goal`: status `active`; objective `Implement production-ready support for the missing route path /guilds/{param}/analytics/audience/participators-by-platform on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal`: status `active` with the same objective before implementation.
- `update_goal(status: "complete")`: completed after implementation, regeneration, verification, and handoff report; worker reported `timeUsedSeconds = 477`.

## Assignment

- Assigned path: `/guilds/{param}/analytics/audience/participators-by-platform`.
- Missing methods found: `GET` only.
- Missing entry confirmed: `GET_GUILDS_GUILD_ID_ANALYTICS_AUDIENCE_PARTICIPATORS_BY_PLATFORM`.
- Source route confirmed: `/guilds/{guild_id}/analytics/audience/participators-by-platform`.
- Methods implemented: `GET`.
- Out of scope: adjacent guild analytics audience routes for guild tenure and registration country, plus growth activation, engagement, channel following, welcome-screen analytics, guild discovery analytics, and other guild analytics paths.

## Evidence Gathered

- `packages/missing-routes/missing.json` had one owned `missing_entries[]` item for the assigned route.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no `GET /guilds/{guild_id}/analytics/audience/participators-by-platform` entry.
- `src/api/routes/guilds/#guild_id/analytics/audience` initially only had `new-members-by-discord-tenure`.
- Userdoccers catalog entry confirmed `userdoccers:resources/guild-analytics.mdx`, summary `Get Guild Audience Participators by Platform`.
- Userdoccers source URL used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild-analytics.mdx`.
- Userdoccers semantics: common query params are `start`, `end`, and `interval`; response buckets have `day_pt`, `platform`, and `participators`; audience analytics exclude opted-out users and suppress small groups for privacy.
- xHyroM references used: none for this route; the missing entry only cited Userdoccers.

## Behavior

- Route file: `src/api/routes/guilds/#guild_id/analytics/audience/participators-by-platform.ts`.
- Auth mode: bearer-authenticated route through normal API auth.
- Permission metadata: `VIEW_GUILD_INSIGHTS`.
- Query metadata: `start`, `end`, and `interval`.
- Response schema: `GuildAudienceParticipatorsByPlatformResponse`, an array of `GuildAudienceParticipatorsByPlatformBucket`.
- Bucket shape: `{ day_pt: string, platform: string, participators: number }`.
- Error metadata: explicit `401`, `403`, and `404` responses with `APIErrorResponse`.
- Data source: Spacebar does not persist durable guild analytics visitor, opt-out, privacy-threshold, platform, or historical bucket data for this endpoint, so the handler returns a typed empty list instead of fabricating platform buckets from current state.
- Worker-only build fix not ported: the worker added a `ChannelMessageCreateRoute.ts` `RequestHandler` annotation for an old-base build issue, but the current integration base builds without it.

## Changed Files

- `src/api/routes/guilds/#guild_id/analytics/audience/participators-by-platform.ts`
- `src/api/routes/guilds/#guild_id/analytics/audience/participators-by-platform.test.ts`
- `src/schemas/responses/GuildAudienceParticipatorsByPlatformResponse.ts`
- `src/schemas/responses/GuildAudienceParticipatorsByPlatformResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-analytics-audience-participators-by-platform-get.md`

Package manifests and lockfiles are unchanged.

## Worker Verification

- `npm run build:src:tsgo`: initially failed on the existing `ChannelMessageCreateRoute.ts` inferred type in the worker worktree, then passed after a narrow `RequestHandler` annotation.
- `npm run generate:schema`: passed; wrote 920 schemas including `GuildAudienceParticipatorsByPlatformResponse`.
- `npm run build:test-fixtures`: passed before and after final generated assets.
- Focused route/schema tests: passed, 5 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed.
- `npm run generate:testing-manifest`: passed; wrote 570 entries.
- `node scripts/testing-manifest/verify.js`: passed with 570 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale, then passed after `npm run generate:contract-tests`; wrote 545 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially stale, then passed after `npm run generate:suite-coverage`; wrote 15 suites.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `NODE_OPTIONS=--preserve-symlinks npm run generate:openapi`: passed and wrote the final valid spec with 373 paths and 920 schemas.
- `npx eslint` on touched TypeScript files: passed.
- `npx prettier --check` on touched TypeScript, test, config, and report files: passed after formatting the report.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness: passed; no dependency manifest or lockfile diffs.
- Changed-file malformed warranty-string scan: passed.
- Local ignored `node_modules` symlink used for verification was removed before handoff.

## Current-Base Orchestrator Verification

- `npm run build:src:tsgo`: passed without the worker's incidental `ChannelMessageCreateRoute.ts` annotation.
- `npm run generate:schema`: passed; wrote 925 schemas including `GuildAudienceParticipatorsByPlatformResponse`.
- `npm run build:test-fixtures`: passed before and after OpenAPI generation.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; reported `Spacebar is missing 711`, `Spacebar implements 469`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed; wrote 574 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale; passed after `npm run generate:contract-tests`.
- `npm run generate:contract-tests`: passed; wrote 549 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially stale; passed after `npm run generate:suite-coverage`.
- `npm run generate:suite-coverage`: passed; wrote 15 suites.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `npm run generate:openapi`: passed; wrote 375 paths and 925 schemas. Existing webhook route metadata warnings remained unrelated.
- Focused route/schema tests: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/guilds/#guild_id/analytics/audience/participators-by-platform.test.js dist-test/src/schemas/responses/GuildAudienceParticipatorsByPlatformResponse.test.js`: passed, 5 tests.
- Focused `eslint`: passed for the changed source, route test, schema, and schema test files.
- Focused `prettier --check`: passed after formatting the changed TypeScript files.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no package manifest or lockfile changes.
- Changed-file malformed warranty-string scan: passed.

## Generated Evidence

- Source catalog should include `GET /guilds/{guild_id}/analytics/audience/participators-by-platform` with response refs `APIErrorResponse` and `GuildAudienceParticipatorsByPlatformResponse`.
- OpenAPI should include `/guilds/{guild_id}/analytics/audience/participators-by-platform/` with bearer security, query params, and `200/401/403/404` response schemas.
- Testing manifest should include `api:http:GET:/guilds/:guild_id/analytics/audience/participators-by-platform/` with bearer auth, `VIEW_GUILD_INSIGHTS`, query metadata, and response statuses `200`, `401`, `403`, `404`.
- Generated HTTP contract for the route should be bearer auth and include the `VIEW_GUILD_INSIGHTS` permission metadata.
- `packages/missing-routes/missing.json` should no longer list the assigned path in `routes` or `missing_entries`.

## Missing-Route Movement

- Worker-base movement: `missing = 716 -> 715`; `spacebar = 464 -> 465`; `discord = 1128`.
- Current-base movement: `missing = 712 -> 711`; `spacebar = 468 -> 469`; `discord = 1128`.

## Risks And Follow-Ups

- The endpoint intentionally returns `[]` until Spacebar has a durable, privacy-aware guild analytics aggregation model for visitors, opt-outs, thresholds, platforms, and historical buckets.
- Adjacent guild analytics routes remain missing and were intentionally not implemented by this worker.
- Recommended next task: design a shared guild analytics aggregation layer before adding non-empty behavior to audience, engagement, growth activation, channel-following, or welcome-screen analytics endpoints.
