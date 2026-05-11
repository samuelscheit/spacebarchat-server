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

# activities-get-2 worker progress

## Goal Evidence

- `create_goal`: created active goal `019e145f-9641-7df1-a2e6-561059f883c7`.
- `get_goal`: status `active`; objective `Implement production-ready support for the missing route path `/activities` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Final `update_goal(status: "complete")`: completed for goal `019e145f-9641-7df1-a2e6-561059f883c7`; time used 751 seconds.

## Summary

- Assigned path: `/activities`.
- Missing methods found on the worker base: `GET_ACTIVITIES` and `POST_ACTIVITIES`.
- Methods implemented on the current integration base: `GET /activities` and `POST /activities`.
- Current-base missing-route movement after regeneration: `missing` `716 -> 714`; `spacebar` implemented count `464 -> 466`; `discord` stayed `1128`.
- Exact `/activities` entries are no longer present in `packages/missing-routes/missing.json`.

## Scope and Exclusions

- Owned exact route path: `/activities`.
- Out-of-scope adjacent paths left untouched: `/activities/{application_id}/test-mode`, `/activities/shelf`, `/activities/statistics/applications`, `/activities/statistics/applications/{application_id}`, `/applications/**`, embedded activity instance routes, presence/gateway behavior.
- xHyroM also lists exact `HEAD` and `OPTIONS` variants for `/activities`, but the current missing report owned only `GET` and `POST`.

## Evidence Gathered

- `packages/missing-routes/missing.json` on the worker base listed exact `/activities` entries:
    - `GET /activities`, route name `GET_ACTIVITIES`, sources `userdoccers:resources/presence.mdx` and `xhyrom:data/client/routes.json`, summary `Get Global Activity Statistics`.
    - `POST /activities`, route name `POST_ACTIVITIES`, sources `userdoccers:resources/presence.mdx` and `xhyrom:data/client/routes.json`, summary `Update Activity Session`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no exact `/activities` entries before implementation.
- `src/api/routes/**` had no exact `/activities` route before implementation. Existing adjacent activity routes were excluded from scope.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` maps exact `GET` and `POST /activities` to the Userdoccers presence source and route names above.
- Userdoccers presence docs, `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/presence.mdx`, document:
    - `GET /activities` as global activity statistics for games recently played by friends and affine users, with optional `with_users` and `with_applications` query booleans.
    - Global activity statistic fields: `user_id`, optional `user`, `application_id`, optional `application`, `updated_at`, and `duration`.
    - `POST /activities` as updating a current user's running activity game session, with request fields `token`, `application_id`, `duration`, `share_activity`, `distributor`, `exe_path`, `voice_channel_id`, `session_id`, `media_session_id`, and `closed`, and response field `token`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` maps exact `/activities` to `GET`, `HEAD`, `OPTIONS`, and `POST` from `xhyrom:data/client/routes.json`; only `GET` and `POST` were owned by this worker.

## Behavior

- `GET /activities`
    - Auth mode: bearer authenticated.
    - Query metadata: optional boolean `with_users` and `with_applications`.
    - Response schema: `GlobalActivityStatisticsResponse`, an array of `GlobalActivityStatistics`.
    - Conservative data source behavior: returns `[]` because Spacebar does not currently persist durable source-backed global friend or affine-user activity statistics.
    - Error metadata: explicit `401` with `APIErrorResponse`.
- `POST /activities`
    - Auth mode: bearer authenticated.
    - Request schema: `ActivitySessionUpdateSchema`, with required `application_id`, optional existing `token`, `duration` constrained to `0..1800`, optional `share_activity`, `distributor`, `exe_path` constrained to length `128`, `voice_channel_id`, `session_id`, `media_session_id`, and `closed`.
    - Response schema: `ActivitySessionUpdateResponse` with `token`.
    - Conservative behavior: validates the session update and returns the existing token or a generated compatibility token. It does not fabricate playtime statistics, persist global activity data, or emit presence/gateway side effects.
    - Error metadata: explicit `400` and `401` with `APIErrorResponse`.

## Changed Files

- `src/api/routes/activities.ts`
- `src/schemas/responses/ActivitySessionUpdateResponse.ts`
- `src/schemas/responses/GlobalActivityStatisticsResponse.ts`
- `src/schemas/responses/index.ts`
- `src/schemas/uncategorised/ActivitySessionUpdateSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/routes/activities-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/activities-get-2.md`

## Worker Verification

- `npm ci`: passed in the worker worktree with ignored local `node_modules/`.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote 920 schemas.
- `npm run build:test-fixtures`: passed.
- Focused route test: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/activities-route.test.js`: passed, 7 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; worker-base report was `Spacebar is missing 716`, `Spacebar implements 464`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed; wrote 569 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale after manifest changes; passed after `npm run generate:contract-tests`.
- `npm run generate:contract-tests`: passed; wrote 544 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `npm run generate:openapi`: passed; wrote 371 paths and 920 schemas.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no package manifest or lockfile changes.
- Changed-file malformed warranty-string scan: passed.

## Current-Base Orchestrator Verification

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote 923 schemas.
- `npm run build:test-fixtures`: passed before and after OpenAPI generation.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; reported `Spacebar is missing 714`, `Spacebar implements 466`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed; wrote 571 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale; passed after `npm run generate:contract-tests`.
- `npm run generate:contract-tests`: passed; wrote 546 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `npm run generate:openapi`: passed; wrote 373 paths and 923 schemas. Existing webhook route metadata warnings remained unrelated.
- Focused route test: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/activities-route.test.js`: passed, 7 tests.
- Focused `eslint`: passed for the changed source and route test files.
- Focused `prettier --check`: passed after formatting the changed source, route test, and report files.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no package manifest or lockfile changes.
- Changed-file malformed warranty-string scan: passed.

## Risks and Blockers

- Spacebar still lacks durable source-backed global friend or affine-user activity statistics. The conservative empty response is intentional and avoids false activity counts.
- `POST /activities` is compatibility-safe validation plus token return only. Real session persistence, global activity stats ingestion, and presence/gateway updates require a broader design and were out of this worker's exact-path scope.

## Recommended Next Tasks

- Design durable activity-session storage and aggregation before returning non-empty global activity statistics.
- Implement source-backed presence/gateway side effects for activity session updates as a separate, explicitly scoped task.
- Address adjacent missing activity routes independently, especially application-specific statistics and test-mode routes.
