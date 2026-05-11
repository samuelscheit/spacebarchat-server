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

# GET /guilds/{guild_id}/analytics/engagement/pruneable-members

## Goal Evidence

- `create_goal` created an active goal with objective: `Implement production-ready support for the missing route path /guilds/{guild_id}/analytics/engagement/pruneable-members on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal` immediately after setup returned status `active` with the same objective.
- Final `update_goal` result: status `complete`, tokens used `170952`, time used `457` seconds.

## Summary

- Assigned missing-report path: `/guilds/{param}/analytics/engagement/pruneable-members`.
- Source route path: `/guilds/{guild_id}/analytics/engagement/pruneable-members`.
- Missing methods found: `GET` only.
- Methods implemented: `GET` only.
- Missing-route count moved from 701 to 700 after regeneration.

## Evidence

- `packages/missing-routes/missing.json` originally listed `GET_GUILDS_GUILD_ID_ANALYTICS_ENGAGEMENT_PRUNEABLE_MEMBERS` with source `userdoccers:resources/guild-analytics.mdx`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `GET /guilds/{guild_id}/analytics/engagement/pruneable-members`, source `userdoccers:resources/guild-analytics.mdx`, summary `Get Guild Engagement Pruneable Members`.
- Userdoccers `pages/resources/guild-analytics.mdx` documents common analytics query params `start`, `end`, and `interval`, and the pruneable-members bucket fields `day_pt` and `inactive`.
- Existing local patterns used: `src/api/routes/guilds/#guild_id/analytics/engagement/base.ts` for guild insights query validation, permission metadata, guild existence check, and conservative empty analytics response; `src/api/routes/guilds/#guild_id/prune.ts` for current prune terminology and why a live prune count is not a historical analytics bucket source.

## Behavior

- Adds authenticated `GET /guilds/:guild_id/analytics/engagement/pruneable-members/`.
- Route metadata declares `permission: "VIEW_GUILD_INSIGHTS"`.
- Route metadata explicitly declares `401`, `403`, `404`, and `422` `APIErrorResponse` responses.
- Validates common analytics query params:
    - `start` and `end` must be non-empty ISO8601 timestamp strings when provided.
    - `interval` must be one of `0`, `1`, `2`, or `3` when provided.
    - `start` must be before or equal to `end`.
- Confirms the guild exists with `Guild.findOneOrFail({ where: { id: guild_id }, select: { id: true } })`.
- Returns `[]` using the new `GuildEngagementPruneableMembersResponse` schema.
- Reuses the current shared engagement analytics query validator introduced by the accepted voice-channel route.
- Does not derive a synthetic bucket from the live prune endpoint because Spacebar does not persist Discord-style historical pruneable-member engagement analytics buckets locally.
- No gateway events, audit-log entries, or pruning side effects are emitted because this is a read-only analytics endpoint.

## Schemas

- Added `GuildEngagementPruneableMembersBucket`:
    - `day_pt: string`
    - `inactive: number`
- Added `GuildEngagementPruneableMembersResponse = GuildEngagementPruneableMembersBucket[]`.
- Regenerated `assets/schemas.json`.
- Regenerated `assets/openapi.json`.

## Changed Files

- `src/api/routes/guilds/#guild_id/analytics/engagement/pruneable-members.ts`
- `src/api/routes/guilds/#guild_id/analytics/engagement/pruneable-members.test.ts`
- `src/schemas/responses/GuildEngagementPruneableMembersResponse.ts`
- `src/schemas/responses/GuildEngagementPruneableMembersResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-analytics-engagement-pruneable-members-get.md`

## Generated Artifacts

- `assets/schemas.json` includes `GuildEngagementPruneableMembersResponse` and `GuildEngagementPruneableMembersBucket`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` includes `GET /guilds/{guild_id}/analytics/engagement/pruneable-members`.
- `packages/missing-routes/missing.json` no longer includes the assigned missing entry.
- `assets/testing-manifest.json` includes `api:http:GET:/guilds/:guild_id/analytics/engagement/pruneable-members/`.
- `test/generated/http-contracts.json` includes the new route contract.
- `test/generated/suite-coverage.json` includes coverage for the new manifest entry.
- `assets/openapi.json` includes `/guilds/{guild_id}/analytics/engagement/pruneable-members/`.

## Verification

- `npm ci`: passed; installed dependencies from lockfile because `node_modules` was absent.
- `npm run build:src:tsgo`: initial run failed before compilation because `@types/node` was unavailable with no `node_modules`; passed after `npm ci`.
- `npm run generate:schema`: passed; wrote 945 schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; reported `Spacebar is missing 700`.
- `npm run generate:testing-manifest`: passed; wrote 585 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially reported stale `test/generated/http-contracts.json`.
- `npm run generate:contract-tests`: passed; wrote 560 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially reported stale `test/generated/suite-coverage.json`.
- `npm run generate:suite-coverage`: passed; wrote 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:openapi`: passed; wrote 386 paths and 945 schemas. Existing warnings remain for unrelated webhook routes missing route metadata.
- `npm run build:test-fixtures`: passed.
- Focused route/schema/base-regression tests: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/guilds/#guild_id/analytics/engagement/pruneable-members.test.js dist-test/src/schemas/responses/GuildEngagementPruneableMembersResponse.test.js dist-test/src/api/routes/guilds/#guild_id/analytics/engagement/base.test.js`: passed, 9 tests.
- Generated contract/suite tests: `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- Focused `npx prettier --write` on changed source/test/config files: passed, unchanged.
- Focused `npx eslint` on changed source/test files: passed.
- Focused `npx prettier --check` on changed source/test/config/report files: passed.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no `package.json` or lockfile changes.
- Malformed warranty-string scan for changed files: passed; no malformed strings found.

## Risks

- Spacebar still lacks durable/source-backed Discord engagement pruneable-member analytics buckets. The route intentionally returns an empty list instead of fabricating `inactive` bucket counts or timestamps.
- The existing live guild prune endpoint can compute current prune eligibility, but it is not a historical analytics aggregation source and was not reused for this response.
- OpenAPI generation still reports unrelated existing webhook route metadata warnings.

## Recommended Next Tasks

- Add a durable analytics aggregation source for guild engagement buckets if Spacebar wants non-empty Discord-compatible analytics responses.
- Once such a source exists, replace the conservative empty response with source-backed `day_pt` and `inactive` buckets and add integration coverage for populated data.
