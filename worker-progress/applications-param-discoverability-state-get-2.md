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

# Application Discoverability State

## Scope

- Assigned route: `GET /applications/{application_id}/discoverability-state`.
- Missing-report form: `GET /applications/{param}/discoverability-state`.
- Methods found and implemented for this exact path: `GET` only.
- Out of scope and not implemented: other application base, RPC, verification, disclosure, embedded activity config, directory, store, and game routes.

## Goal And Source Evidence

- Worker `create_goal`: created an active goal for this route assignment.
- Worker `get_goal`: returned active status with the same objective before file/code research.
- Worker `update_goal`: final handoff reported completion after 741 seconds.
- `packages/missing-routes/missing.json` listed one owned `GET` entry for this path before the current-base port.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists route `/applications/{application_id}/discoverability-state`, route name `GET_APPLICATIONS_APPLICATION_ID_DISCOVERABILITY_STATE`, and source `userdoccers:resources/application.mdx`.
- Worker checked Userdoccers application docs for owner/team access and response fields `discoverability_state`, `discovery_eligibility_flags`, and `bad_commands`.

## Behavior

- Auth mode: bearer-authenticated route with explicit `401: APIErrorResponse` metadata.
- Authorization: application owner, owning team owner, or accepted owning-team member can read the state via the existing `canAccessApplicationGiftCodeBatches` helper semantics.
- Errors: missing application throws `UNKNOWN_APPLICATION` / 404; unauthorized callers throw `ACTION_NOT_AUTHORIZED_ON_APPLICATION` / 400.
- Response: `ApplicationDiscoverabilityStateResponse` with required `discoverability_state`, `discovery_eligibility_flags`, and `bad_commands`.
- Data source: persisted `Application.discoverability_state`, persisted `Application.discovery_eligibility_flags`, and serialized global application commands where local `nsfw` is true.
- Omission policy: Discord-only discoverability review predicates are not fabricated; if local bad-command evidence is absent, `bad_commands` is empty.

## Accepted Current-Base Changes

- `src/api/routes/applications/#application_id/discoverability-state.ts`
- `src/schemas/responses/ApplicationDiscoverabilityStateResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/applications-discoverability-state.test.ts`
- `assets/schemas.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `assets/openapi.json`
- `worker-progress/applications-param-discoverability-state-get-2.md`

## Excluded Worker Changes

- The worker's `src/api/util/handlers/ChannelMessageCreateRoute.ts` type annotation was not ported because current-base `npm run build:src:tsgo` passed without it.
- The worker's new shared application owner/team helper was not ported; the accepted route uses the existing access helper to keep the change narrower.

## Current-Base Verification

- `npm run build:src:tsgo`: passed without the worker's old-base message handler annotation.
- `npm run generate:schema`: passed; wrote 934 schemas.
- `npm run build:test-fixtures`: passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; `707 -> 706` missing, `473 -> 474` implemented, `1128` Discord.
- `npm run generate:testing-manifest`: passed; wrote 579 entries.
- `node scripts/testing-manifest/verify.js`: passed; verified 579 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale.
- `npm run generate:contract-tests`: passed; wrote 554 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed; verified 554 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially stale.
- `npm run generate:suite-coverage`: passed; wrote 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:openapi`: passed; wrote 380 paths and 934 schemas. Existing webhook route metadata warnings remained.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/applications-discoverability-state.test.js`: passed, 11 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `npx prettier --check ...changed source/test files...`: passed.
- `npx eslint ...changed source/test files...`: passed.

## Risks

- `bad_commands` is backed only by local `ApplicationCommand.nsfw`; additional Discord review classifications need future persistence before they can be represented.
- The response uses local default discoverability state and eligibility flags when existing rows have null values, matching current model defaults rather than fabricating external review state.
