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

# activities-param-test-mode-get-2

## Goal Evidence

- `create_goal`: active objective: Implement production-ready support for the missing route path `/activities/{param}/test-mode` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- `get_goal`: active objective confirmed with status `active`.
- `update_goal`: status set to `complete` after verification and completion audit. Final goal usage: 2117 seconds.

## Summary

Implemented the owned `/activities/{param}/test-mode` route for:

- `GET /activities/{param}/test-mode`
- `POST /activities/{param}/test-mode`

The route file is `src/api/routes/activities/#application_id/test-mode.ts`, which produces source catalog path `/activities/{application_id}/test-mode` and manifest IDs:

- `api:http:GET:/activities/:application_id/test-mode/`
- `api:http:POST:/activities/:application_id/test-mode/`

No adjacent routes were implemented. Specifically left out of scope: `/activities`, `/activities/{param}/{param}`, `/activities/{param}/instances/{param}`, `/activities/statistics/applications/{param}`, `/applications/{param}/embedded-activity-config`, `/applications/{param}/rpc`, and application directory routes.

## Evidence

- `packages/missing-routes/missing.json` initially had exactly two owned entries for `/activities/{param}/test-mode`: `GET_ACTIVITIES_APPLICATION_ID_TEST_MODE` and `ACTIVITY_TEST_MODE`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` initially had no `/activities/{application_id}/test-mode` implementation.
- Userdoccers `resources/application.mdx` documents `GET /activities/{application.id}/test-mode` as "Query Application Test Mode", owner or owning-team developer access, and `204` empty success. It also states test mode allows completing purchases without payment.
- xHyroM `data/client/routes.json` lists `ACTIVITY_TEST_MODE` at `/activities/:param/test-mode` with `GET`, `HEAD`, `OPTIONS`, and `POST`; the missing-routes report owned only `GET` and `POST`.
- Local `Application` persistence has no durable commerce test-mode state, so the implementation validates source-backed access and returns empty `204` without fabricating local state.

## Behavior

- Auth mode: bearer-authenticated. Both route metadata entries include explicit `401: { body: "APIErrorResponse" }`.
- Authorization: requester must be the application owner, owning team owner, or an accepted owning-team member with `ADMIN` or `DEVELOPER` role.
- Lookup: loads the application by `application_id` with `owner` and `team.members` relations.
- Success: `204` empty response for both `GET` and `POST`.
- Errors: unknown application uses `DiscordApiErrors.UNKNOWN_APPLICATION` (`404`); unauthorized application access uses `DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION` (`400`); auth middleware supplies `401`.
- Side effects: none. No gateway events, audit logs, or database writes are emitted because Spacebar lacks durable Discord commerce test-mode state.

## Changed Files

- `src/api/routes/activities/#application_id/test-mode.ts` - new GET/POST route and authorization helpers.
- `test/routes/activity-test-mode.test.ts` - focused behavior/auth/error/generated-artifact tests.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - regenerated source route catalog with GET/POST test-mode entries.
- `packages/missing-routes/missing.json` - regenerated missing report; assigned route removed.
- `assets/testing-manifest.json` - regenerated testing manifest.
- `test/generated/http-contracts.json` - regenerated HTTP contract catalog.
- `assets/openapi.json` - regenerated OpenAPI paths/schemas.
- `worker-progress/activities-param-test-mode-get-2.md` - this report.

Package manifests and lockfiles are unchanged.

## Worker Verification

Passed:

- `npm run build:src:tsgo`
- `NODE_OPTIONS=--preserve-symlinks npm run generate:schema`
- `npm run build:test-fixtures`
- `NODE_OPTIONS=--preserve-symlinks node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/activity-test-mode.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run generate:contract-tests` after the first check found stale contract artifacts
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `NODE_OPTIONS=--preserve-symlinks npm run generate:openapi`
- `git diff --check`
- package manifest/lockfile cleanliness check
- changed-file malformed warranty-string scan

Notable failed/intermediate checks:

- Direct `node --test test/routes/activity-test-mode.test.ts` failed before fixture build because raw TypeScript tests do not have the repo's module alias setup.
- The first `npm run build:src:tsgo` failed on an existing declaration portability issue in `ChannelMessageCreateRoute.ts` in the worker worktree, but the current integration base builds without that incidental annotation and it was not ported.
- `npm run generate:openapi` without `NODE_OPTIONS=--preserve-symlinks` produced a broken `0 paths` OpenAPI file in the worker worktree because the ignored `node_modules` symlink made `module-alias/register` point at the shared checkout. Current-base verification does not rely on this stale artifact.

## Generated Artifact Evidence

- Source catalog should contain:
    - `GET /activities/{application_id}/test-mode`, `GET_ACTIVITIES_APPLICATION_ID_TEST_MODE`
    - `POST /activities/{application_id}/test-mode`, `POST_ACTIVITIES_APPLICATION_ID_TEST_MODE`
- OpenAPI should contain `GET` and `POST` under `/activities/{application_id}/test-mode/`, both with bearer security and `204`, `400`, `401`, `404` response metadata.
- Testing manifest should contain both owned manifest IDs with `authMode: "bearer"`, statuses `[204, 400, 401, 404]`, and response body `APIErrorResponse`.
- Generated HTTP contracts should contain both owned manifest IDs pointing at `src/api/routes/activities/#application_id/test-mode.ts`.

## Missing-Route Movement

- Worker-base movement: `missing = 738 -> 736`; `spacebar = 442 -> 444`; `discord = 1128`.
- Current-base movement: `missing = 714 -> 712`; `spacebar = 466 -> 468`; `discord = 1128`.

## Current-Base Orchestrator Verification

- `npm run build:src:tsgo`: passed without the worker's incidental `ChannelMessageCreateRoute.ts` annotation.
- `npm run build:test-fixtures`: passed before and after OpenAPI generation.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; reported `Spacebar is missing 712`, `Spacebar implements 468`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed; wrote 573 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale; passed after `npm run generate:contract-tests`.
- `npm run generate:contract-tests`: passed; wrote 548 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `npm run generate:openapi`: passed; wrote 374 paths and 923 schemas. Existing webhook route metadata warnings remained unrelated.
- Focused route test: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/activity-test-mode.test.js`: passed, 9 tests.
- Focused `eslint`: passed for the changed source and route test files.
- Focused `prettier --check`: passed after formatting the changed source, route test, and report files.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no package manifest or lockfile changes.
- Changed-file malformed warranty-string scan: passed.

## Completion Audit

- Own every `missing_entries[]` item whose `route` is exactly `/activities/{param}/test-mode`: complete; found and implemented GET and POST.
- Confirm absence before implementation: complete; source catalog and route tree had no exact route.
- Keep adjacent routes out of scope: complete; no adjacent route files added.
- Source-backed behavior/auth/errors: complete; Userdoccers and xHyroM evidence recorded above.
- Conservative no-fabricated-state behavior: complete; validates access and returns documented empty `204`.
- Focused tests: complete; route test covers auth, authorization, unknown application, 204 empty responses, no local state fabrication, and generated artifacts.
- Regenerated catalogs/artifacts: complete; source catalog, missing routes, testing manifest, contract catalog/tests, and OpenAPI regenerated as applicable on the current base.
- Verification gates: complete; commands listed above.
- Handoff report: complete, including final `update_goal(status: "complete")` evidence.

## Risks And Next Tasks

- Durable Discord commerce test-mode persistence is not implemented because no local persistence model exists. If Spacebar later models application commerce/test-mode state, replace the conservative `POST` no-op success with a real state write and have `GET` reflect that state.
