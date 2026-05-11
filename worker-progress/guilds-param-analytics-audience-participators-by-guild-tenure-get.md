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

# Guild Audience Participators by Guild Tenure

## Scope

- Assigned route: `GET /guilds/{guild_id}/analytics/audience/participators-by-guild-tenure`.
- Missing-report form: `GET /guilds/{param}/analytics/audience/participators-by-guild-tenure`.
- Methods found and implemented for this exact path: `GET` only.
- No platform, registration-country, new-member-tenure, engagement, growth activation, channel following, welcome-screen, discovery, or other guild analytics routes were implemented.

## Goal And Brief Evidence

- Worker `create_goal`: created active goal `019e147c-1b3d-76e3-abfb-b79dc0816c34` for this route assignment.
- Worker `get_goal`: returned status `active` with the same objective immediately after goal creation.
- Worker `update_goal`: final handoff reported completion for thread `019e147c-1b3d-76e3-abfb-b79dc0816c34` after 445 seconds.
- Audit note: the worker report said `WORKER_BRIEF.md` was not present in the worker worktree. During orchestrator acceptance, the central `/Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md` was read and the current-base port was checked against its route-work and handoff requirements.

## Source Evidence

- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists route `/guilds/{guild_id}/analytics/audience/participators-by-guild-tenure`, route name `GET_GUILDS_GUILD_ID_ANALYTICS_AUDIENCE_PARTICIPATORS_BY_GUILD_TENURE`, source `userdoccers:resources/guild-analytics.mdx`, and summary `Get Guild Audience Participators by Guild Tenure`.
- `packages/missing-routes/missing.json` listed the route under `missing_entries` before this current-base port.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` had no matching entry.
- The worker also checked Userdoccers guild analytics docs for bucket field names `day_pt`, `tenure`, and `participators`.

## Behavior

- The route is bearer-authenticated through the existing `route()` metadata model.
- Permission: `VIEW_GUILD_INSIGHTS`, matching adjacent guild audience analytics routes.
- Query metadata: optional `start`, `end`, and `interval`, matching adjacent audience analytics route metadata.
- Responses: `200: GuildAudienceParticipatorsByGuildTenureResponse`, plus explicit `401`, `403`, and `404` `APIErrorResponse` metadata.
- Runtime behavior returns `200` with `[]`.
- Data gap: Spacebar does not currently persist Discord-compatible guild analytics visitor, opt-out, privacy-threshold, guild-tenure, or historical aggregates. The implementation returns a conservative empty list rather than fabricating buckets or counts.

## Changed Files

- `src/api/routes/guilds/#guild_id/analytics/audience/participators-by-guild-tenure.ts`
- `src/api/routes/guilds/#guild_id/analytics/audience/participators-by-guild-tenure.test.ts`
- `src/schemas/responses/GuildAudienceParticipatorsByGuildTenureResponse.ts`
- `src/schemas/responses/GuildAudienceParticipatorsByGuildTenureResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `assets/openapi.json`
- `worker-progress/guilds-param-analytics-audience-participators-by-guild-tenure-get.md`

## Current-Base Verification

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote 933 schemas.
- `npm run build:test-fixtures`: passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; `708 -> 707` missing, `472 -> 473` implemented, `1128` Discord.
- `npm run generate:testing-manifest`: passed; wrote 578 entries.
- `node scripts/testing-manifest/verify.js`: passed; verified 578 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale.
- `npm run generate:contract-tests`: passed; wrote 553 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed; verified 553 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially stale.
- `npm run generate:suite-coverage`: passed; wrote 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:openapi`: passed; wrote 379 paths and 933 schemas. Existing webhook `route()` middleware warnings remained.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/guilds/#guild_id/analytics/audience/participators-by-guild-tenure.test.js' dist-test/src/schemas/responses/GuildAudienceParticipatorsByGuildTenureResponse.test.js`: passed, 5 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `npx prettier --check ...changed TS/config files...`: initially failed for new source/tests and `tsconfig.test.json`; `npx prettier --write ...` fixed them; rerun passed.
- `npx eslint ...changed TS files...`: passed.
- `npx prettier --check worker-progress/guilds-param-analytics-audience-participators-by-guild-tenure-get.md`: passed.
- Final `npm run build:src:tsgo`: passed after formatting.
- Final `npm run build:test-fixtures`: passed after formatting.
- Final focused compiled route/schema tests: passed, 5 tests.
- Final generated contract/suite tests: passed, 13 tests.
- `git diff --check`: passed.
- Package manifest/lockfile guard: no package or lockfile changes.
- Warranty-line scan: new source, test, and report files each contain exactly one required AGPL warranty line and no malformed variants.

## Risks

- This is compatibility-oriented until durable guild analytics aggregate storage exists.
- The original worker did not read the central worker brief from the worktree. The accepted current-base port was audited against the central brief before merge.
