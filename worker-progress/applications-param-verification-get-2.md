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

# applications-param-verification-get-2

## Goal Evidence

- `create_goal`: active goal created for "Implement production-ready support for the missing route path `GET /applications/{param}/verification` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report."
- `get_goal`: status `active`; objective confirmed as above.
- `update_goal(status: "complete")`: status `complete`; time used `1216` seconds; tokens used `1048213`.

## Assignment

- Worker id: `applications-param-verification-get-2`
- Assigned path: `/applications/{param}/verification`
- Missing methods found: `GET`
- Method implemented: `GET /applications/{application_id}/verification`
- Missing entry removed: `GET_APPLICATIONS_APPLICATION_ID_VERIFICATION`
- Out of scope and not implemented: `/applications/{param}`, `/applications/{param}/delete`, `/applications/{param}/can-delete`, `/applications/{param}/discoverability-state`, `/applications/{param}/auto-verification`, storefront, social SDK, verification submit, ownership-transfer, and other adjacent application paths.

## Evidence

- `packages/missing-routes/missing.json` initially had one owned entry for `GET /applications/{param}/verification`, sourced from `userdoccers:resources/application.mdx`, source route `/applications/{application_id}/verification`, summary `Get Application Verification Eligibility`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no application verification entry.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` contains `GET /applications/{application_id}/verification` with the same route name and summary.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` and merged `routes.catalog.json` had no `/applications/.../verification` entry, so Userdoccers was the source of record.
- Userdoccers documents this endpoint as deprecated, returning empty `204` on successful eligibility, and lists application/team/link/account criteria for verification.
- Existing local application owner/team access patterns came from `src/api/util/utility/ApplicationAuthorization.ts`, `src/api/routes/applications/#application_id/branches.ts`, and `src/api/routes/applications/#application_id/can-delete.ts`.

## Behavior

- Auth mode: authenticated bearer route. Metadata explicitly includes `401: { body: "APIErrorResponse" }`.
- Success: returns empty `204` with no response body.
- Lookup: loads the application by `application_id` with owner, owning team, team owner user, accepted team members, ToS/privacy/install fields, and account flags required for local eligibility checks.
- Authorization: allows application owner, owning team owner, or accepted owning-team member using the existing owner/team access helper; rejects other callers with `DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION`.
- Unknown application: throws `DiscordApiErrors.UNKNOWN_APPLICATION` (`404`).
- Conservative eligibility: fails closed with `FieldErrors` (`400`) when locally verifiable criteria are absent: team ownership, ToS URL, privacy policy URL, install params/custom install URL, or verified email plus MFA for accepted team members/team owner.
- Documented but not fabricated: harmful-language review, command/role-connection language scanning, Discord trust-and-safety review state, and team-owner identity verification state are not implemented because Spacebar has no source-backed local predicates for them in this route.

## Changed Files

- `src/api/routes/applications/#application_id/verification.ts`
- `test/routes/applications-verification.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `assets/openapi.json`
- `worker-progress/applications-param-verification-get-2.md`

## Worker Verification

- `npm run build:src:tsgo`: initially failed on an unrelated exported inferred type in `ChannelMessageCreateRoute.ts`; passed after a type-only annotation in the worker worktree.
- `npm run generate:schema`: not run; no schema files changed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; wrote updated missing report.
- `npm run generate:testing-manifest`: passed.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale, then passed after `npm run generate:contract-tests`.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially stale, then passed after `npm run generate:suite-coverage`.
- `NODE_OPTIONS=--preserve-symlinks npm run generate:openapi`: passed.
- `npm run build:test-fixtures`: passed.
- Focused compiled route test: passed; 12 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed; 13 tests.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no `package.json` or `package-lock.json` diff.
- Malformed warranty-string scan: passed across changed files.

## Missing-Route Movement

- Worker base movement: `Spacebar is missing 739 -> 738`; assigned path entries remaining in `missing_entries`: `0`.
- Current-base orchestrator verification: `Spacebar is missing 720 -> 719`, `Spacebar implements 460 -> 461`, `Discord implements 1128`; assigned path entries remaining in `missing_entries`: `0`.

## Current-Base Orchestrator Verification

- `npm run build:src:tsgo`: passed without the worker's incidental `ChannelMessageCreateRoute.ts` annotation.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed, `720 -> 719` missing and `460 -> 461` implemented.
- `npm run generate:testing-manifest`: passed, 566 entries.
- `node scripts/testing-manifest/verify.js`: passed, 566 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale; passed after `npm run generate:contract-tests`.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially stale; passed after `npm run generate:suite-coverage`.
- `npm run generate:openapi`: passed, 369 paths and 914 schemas.
- `npm run build:test-fixtures`: passed.
- Focused compiled route test: passed, 12/12.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13/13.
- Focused `npx eslint`: passed.
- `npx prettier --check` after formatting: passed.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness guard: passed.
- Changed-file malformed warranty-string scan: passed.

## Risks And Notes

- The route intentionally implements only local, source-backed eligibility predicates. It does not attempt to simulate Discord review state, harmful-content scanning, command metadata review, or identity verification.
- Authorization follows existing owner/team read access behavior, not the POST auto-verification team-owner-only behavior.

## Recommended Next Tasks

- Implement `/applications/{param}/auto-verification` separately if assigned; do not reuse this GET route as proof of completed verification submission.
- Consider a shared application-owner/team authorization helper with a neutral name if more developer application routes are added.
