# POST /application-identities

## Summary

Integrated the assigned missing route `POST /application-identities`. The route is authenticated, requires an OAuth-style application token claim, validates `user_ids` as a 1-100 item string array with non-coercing request-body validation, ignores invalid snowflake-looking IDs in route normalization, and returns a typed empty compatibility response because Spacebar has no durable application-scoped identity store yet.

## Assigned Path

- Assigned path: `/application-identities`
- Missing methods found before implementation: `POST`
- Missing entry: `POST_APPLICATION_IDENTITIES`, summary `Get Bulk Application Identities`
- Methods implemented: `POST`
- Adjacent routes intentionally not touched: application directory, application profiles, OAuth2 token issuance, role connections, identity-provider configuration routes, and `/users/{user_id}/application-identities`.

## Evidence Gathered

- Current-base `packages/missing-routes/missing.json` contains exactly one assigned entry for `POST /application-identities`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` has no `/application-identities` entry before integration.
- `src/api/routes/**` has no `/application-identities` implementation before integration.
- Local Userdoccers catalog contains `POST /application-identities` from `userdoccers:resources/application.mdx`.
- Local xHyroM catalog contains no `/application-identities` route entry.
- Userdoccers source documents `POST /application-identities` as OAuth2-capable `Get Bulk Application Identities`, with `user_ids` array length 1-100, invalid IDs ignored, and partial identity fields `user_id` and `external_user_id`.
- Data model review found no durable application identity/profile table and no application-scoped identity provider state. Existing `ConnectedAccount` rows are global user connection data and are not safe to serialize as application identities.

## Changed Files

- `src/api/routes/application-identities.ts`
- `src/api/routes/application-identities.test.ts`
- `src/schemas/uncategorised/ApplicationIdentitiesSchema.ts`
- `src/schemas/uncategorised/ApplicationIdentitiesSchema.test.ts`
- `src/schemas/uncategorised/index.ts`
- `src/schemas/responses/ApplicationIdentitiesResponse.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/application-identities-post.md`

## What Changed

- Added `POST /application-identities` route metadata with summary, `ApplicationIdentitiesSchema` request body, non-coercing body validation, `ApplicationIdentitiesResponse` 200 body, and `400/401 APIErrorResponse`.
- Added OAuth application claim extraction for `application_id`, `client_id`, nested `application.id`, `azp`, and `aud`; tokens without an application identity fail closed with `INVALID_OAUTH_TOKEN`.
- Added request schema for `user_ids` with `minItems: 1` and `maxItems: 100`.
- Added response schema for `ApplicationIdentitiesResponse = PartialApplicationIdentityResponse[]`.
- Added focused compiled tests for route metadata, OAuth app-claim enforcement, ID normalization, compatibility response, and schema bounds/type validation.

## Missing-Route Count Movement

- Before current-base integration: `817` missing, `363` implemented.
- Expected after regeneration: `816` missing, `364` implemented.
- The assigned `/application-identities` entry should disappear from `packages/missing-routes/missing.json`.

## Verification Results

The original worker verified npm install state, source build, fixture build, focused compiled tests, source-catalog import, missing-route generation, schema generation, testing manifest generation/verification, contract/suite coverage checks, OpenAPI, diff check, and warranty typo scan.

Current-base orchestrator verification after porting this source onto `17ebf3edd`:

- `npm run build:src:tsgo` passed.
- `npm run generate:schema` passed and wrote `728` schemas.
- `npm run build:test-fixtures` passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/schemas/uncategorised/ApplicationIdentitiesSchema.test.js dist-test/src/api/routes/application-identities.test.js` passed: `6` tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed: `Spacebar is missing 816`, `Spacebar implements 364`, `Discord implements 1128`.
- `npm run generate:testing-manifest` passed and wrote `469` entries.
- `node scripts/testing-manifest/verify.js` passed.
- `npm run generate:contract-tests` and `node scripts/testing-manifest/generate-contract-tests.js --check` passed with `444` contracts.
- `npm run generate:suite-coverage` and `node scripts/testing-manifest/generate-suite-coverage.js --check` passed with `15` suites.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: `13` tests.
- `npm run generate:openapi` passed with `288` paths and `728` schemas; only pre-existing webhook route-metadata warnings were emitted.

## Risks And Blockers

- Spacebar does not persist application-scoped external identities or identity-provider links, so the route cannot return real `{ user_id, external_user_id }` rows yet.
- Current Spacebar OAuth2 token issuance is incomplete for this use case. The route fails closed unless `req.token` carries an application identity claim, matching the source-backed OAuth2-only requirement without inventing an undocumented scope.
- `ConnectedAccount` is intentionally not used because it is global user connection data and not scoped to the authorized application.

## Recommended Next Tasks

- Add durable application identity/provider state keyed by application and user before returning non-empty identity data.
- Implement scoped OAuth2 access-token issuance/validation for application identity flows.
- Implement the adjacent identity-provider configuration/profile routes in separate assigned work.

## Goal Status Evidence

- Initial `create_goal` objective: implement the missing route path `POST /application-identities` for the Spacebar server API.
- Initial `get_goal` status: `active`
- Initial `get_goal` objective: implement the missing route path `POST /application-identities` for the Spacebar server API.
