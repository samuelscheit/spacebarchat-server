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

# Application External Identity Provider Configurations

## Scope

- Assigned route: `GET /applications/{application_id}/external-identity-provider-configurations`.
- Missing-report form: `GET /applications/{param}/external-identity-provider-configurations`.
- Methods found and implemented for this exact path: `GET` only.
- Out of scope and not implemented: provider-specific mutation routes, disclosures, managed links, proxy config, verification, OAuth2, and adjacent application routes.

## Goal And Source Evidence

- Worker `create_goal`: created an active goal for this exact route assignment.
- Worker `get_goal`: returned active status with the same objective.
- Worker `update_goal`: final handoff reported completion after 659 seconds.
- `packages/missing-routes/missing.json` listed one owned `GET` entry for this path before the current-base port.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists route `/applications/{application_id}/external-identity-provider-configurations`, route name `GET_APPLICATIONS_APPLICATION_ID_EXTERNAL_IDENTITY_PROVIDER_CONFIGURATIONS`, and source `userdoccers:resources/application.mdx`.
- Worker checked Userdoccers application docs for the response fields `application_id`, `provider_type`, `client_id`, `oidc_issuer_url`, and `clients`.

## Behavior

- Auth mode: bearer-authenticated route with explicit `401: APIErrorResponse` metadata.
- Access: requires application owner, owning team owner, or accepted owning-team member access through existing `requireApplicationBranchAccess` semantics.
- Errors: missing application returns `UNKNOWN_APPLICATION`; unauthorized callers return `ACTION_NOT_AUTHORIZED_ON_APPLICATION`; missing bearer auth returns `401`.
- Response: `ApplicationExternalIdentityProviderConfigurationsResponse`, an array of documented configuration objects.
- Data source: Spacebar has no durable local external identity provider configuration state, so the route returns a fresh empty array after existence and access checks.

## Accepted Current-Base Changes

- `src/api/routes/applications/#application_id/external-identity-provider-configurations.ts`
- `src/schemas/responses/ApplicationExternalIdentityProviderConfigurationsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/applications-external-identity-provider-configurations.test.ts`
- `assets/schemas.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `assets/openapi.json`
- `worker-progress/applications-param-external-identity-provider-configurations-get-2.md`

## Excluded Worker Change

- The worker's `src/api/util/handlers/ChannelMessageCreateRoute.ts` type annotation was not ported because current-base `npm run build:src:tsgo` passed without it.

## Current-Base Verification

- `npm run build:src:tsgo`: passed without the worker's old-base message handler annotation.
- `npm run generate:schema`: passed; wrote 937 schemas.
- `npm run build:test-fixtures`: passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; `706 -> 705` missing, `474 -> 475` implemented, `1128` Discord.
- `npm run generate:testing-manifest`: passed; wrote 580 entries.
- `node scripts/testing-manifest/verify.js`: passed; verified 580 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale.
- `npm run generate:contract-tests`: passed; wrote 555 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed; verified 555 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially stale.
- `npm run generate:suite-coverage`: passed; wrote 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:openapi`: passed; wrote 381 paths and 937 schemas. Existing webhook route metadata warnings remained.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/applications-external-identity-provider-configurations.test.js`: passed, 9 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `npx prettier --check ...changed source/test files...`: passed.
- `npx eslint ...changed source/test files...`: passed.

## Risks

- The route intentionally returns an empty array until durable provider configuration persistence exists.
- The adjacent provider-specific mutation routes remain missing and should wait on a clear persistence design.
