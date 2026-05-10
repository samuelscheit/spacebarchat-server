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

# applications-param-can-delete-get-2

## Goal Evidence

- `create_goal`: succeeded for objective `Implement production-ready support for the missing route path /applications/{param}/can-delete on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal`: status `active`, objective matched the assignment.
- `update_goal`: completed after verification and report drafting; final status `complete`, tokens used `803952`, time used `1162` seconds.

## Scope

- Assigned path: `/applications/{param}/can-delete`
- Missing methods found: `GET`
- Methods implemented: `GET /applications/{application_id}/can-delete/`
- Owned missing entry source: `userdoccers:resources/application.mdx`
- Out of scope and not implemented: `/applications/{param}`, `/applications/{param}/delete`, `/applications/{param}/verification`, `/applications/{param}/discoverability-state`, application ownership transfer routes, and unrelated application routes.

## Evidence

- `HEAD:packages/missing-routes/missing.json` had one owned missing entry: `GET /applications/{param}/can-delete`, route name `GET_APPLICATIONS_APPLICATION_ID_CAN_DELETE`, source route `/applications/{application_id}/can-delete`, summary `Get Application Undeletable Reason`.
- `HEAD:packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `/applications/{application_id}/can-delete` entry.
- `HEAD` had no `src/api/routes/applications/#application_id/can-delete.ts` route file.
- Current source catalog now contains `GET /applications/{application_id}/can-delete` from `src/api/routes/applications/#application_id/can-delete.ts` with response schemas `APIErrorResponse` and `ApplicationCanDeleteResponse`.
- Userdoccers application docs at `https://docs.discord.food/resources/application` define `Application Undeletable Reason` enum values `UNKNOWN`, `USER_THRESHOLD_EXCEEDED`, `SOCIAL_SDK_APP_DELETION_ERROR`, and `PARENT_HAS_CHILD_APPLICATIONS`; the docs list `GET /applications/{application_id}/can-delete` as `Get Application Undeletable Reason`.
- Local application/team authorization patterns reviewed: `src/api/routes/applications/#application_id/index.ts`, `src/api/routes/teams/#team_id/applications.ts`, and `src/api/util/utility/ApplicationAuthorization.ts`.

## Behavior

- Auth mode: bearer. Route metadata explicitly includes `401: { body: "APIErrorResponse" }`.
- Response schema: `ApplicationCanDeleteResponse` with optional nullable `deletable` and optional nullable `reason`; `reason` is backed by `ApplicationUndeletableReason` enum values `0..3`.
- Data source: `Application.findOne({ where: { id }, relations: { owner: true, team: { members: true } } })`.
- Authorization: application owner, owning-team owner, or accepted owning-team member may view deletion state.
- Unknown application: throws `DiscordApiErrors.UNKNOWN_APPLICATION` and returns 404 through the API error handler.
- Unauthorized application access: throws `DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION` and returns its normal API error response.
- Conservative undeletable semantics: Spacebar does not persist Discord active-user threshold, social SDK deletion blockers, or parent-child application state. For authorized local applications, the route returns `{ "deletable": true }` and omits `reason` instead of fabricating Discord-only reasons.

## Changed Files

- `src/api/routes/applications/#application_id/can-delete.ts`
- `src/schemas/responses/ApplicationCanDeleteResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/applications-can-delete.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/applications-param-can-delete-get-2.md`

## Verification

- Worker-base verification passed: source build, schema generation, test fixture build, focused route tests 10/10, automatic reverse-engineering build, source catalog import, missing-route regeneration, testing manifest verification, generated contract and suite coverage checks, generated contract/suite tests 13/13, OpenAPI generation, diff checks, package manifest/lockfile guard, and malformed warranty-string scan.
- Current-base verification on `85c3c2b37` passed: `npm run build:src:tsgo`, `npm run generate:schema`, `npm run build --workspace @spacebar/automatic-reverse-engineering`, source catalog import, `npm run build --workspace @spacebar/missing-routes`, `npm run start --workspace @spacebar/missing-routes`, `npm run generate:testing-manifest`, `node scripts/testing-manifest/verify.js`, generated contract regeneration/check, generated suite coverage regeneration/check, `npm run generate:openapi`, `npm run build:test-fixtures`, focused compiled route tests 10/10, generated contract/suite tests 13/13, `git diff --check`, package manifest/lockfile guard, malformed warranty-string scan, and artifact spot-checks for `/applications/{application_id}/can-delete/`.
- Current-base `npm run generate:schema`: passed, wrote 863 schemas.
- Current-base `npm run start --workspace @spacebar/missing-routes`: passed, `Spacebar is missing 740`, `Spacebar implements 440`, `Discord implements 1128`.
- Current-base `npm run generate:testing-manifest`: passed, wrote 545 entries.
- Current-base generated contract checks: passed after regeneration, 520 contracts.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13/13 tests.
- `npm run generate:openapi`: passed, 349 paths and 863 schemas; retained the existing 3 route-metadata warnings.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed, no package manifest or lockfile diffs.
- malformed warranty-string scan: passed across changed files.

## Regeneration Movement

- Worker-base missing-route count moved from 760 to 759.
- Worker-base Spacebar implemented-route count moved from 420 to 421.
- Current-base missing-route count moved from 741 to 740.
- Current-base Spacebar implemented-route count moved from 439 to 440.
- Owned missing entry moved from present to absent in `packages/missing-routes/missing.json`.
- Current-base testing manifest moved from 544 to 545 entries.
- Current-base HTTP contract count moved from 519 to 520 contracts.

## Notes

- The worker used a local ignored dependency shim on its old worktree; no dependency shim or package manifest change was ported to the current checkout.
- No commits or pushes were made by the worker.

## Risks And Next Tasks

- Discord may block deletion for states Spacebar does not currently store, especially active-user thresholds, social SDK deletion errors, and child application relationships. The route intentionally avoids inventing those reasons.
- Future work could add persisted local equivalents for child application relationships or active-user threshold tracking, then return the corresponding `ApplicationUndeletableReason` values when those states are actually source-backed.
