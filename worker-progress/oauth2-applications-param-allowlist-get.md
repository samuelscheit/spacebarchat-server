# GET /oauth2/applications/{param}/allowlist

## Orchestrator Current-Base Merge Review

After merging current integration base `cb16ad240`, the route was regenerated and
verified again with the already-accepted OAuth application asset deletion and
channel directory entry counts changes present.

- Current-base missing-route movement: `658 -> 657`.
- Current-base implemented-route movement: `522 -> 523`.
- `npm run generate:schema` wrote 1002 schemas.
- `npm run generate:testing-manifest` wrote and verified 628 entries.
- `npm run generate:contract-tests` wrote and verified 603 contracts.
- `npm run generate:suite-coverage` wrote and verified 15 suites.
- `npm run generate:openapi` wrote 417 paths and 1002 schemas; the existing
  webhook route metadata warnings remain unrelated.
- Focused current-base tests passed: allowlist GET, adjacent allowlist DELETE,
  OAuth application asset DELETE, and channel directory entry counts, 31/31.
- Generated contract/suite tests passed, 13/13.
- `npm run test:manifest` and `npm run test:suite-coverage` passed.

## Summary

Implemented exactly `GET /oauth2/applications/{application_id}/allowlist` for listing OAuth application testers.

The route validates malformed application IDs as `Unknown application`, requires the application owner, owning team owner, or accepted owning-team member, returns tester rows as `[{ user, state }]`, and maps application authorization failures to HTTP `403` like the adjacent tester deletion route.

Adjacent routes intentionally not implemented: `POST /oauth2/applications/{application_id}/allowlist`, `POST /oauth2/allowlist/accept`, tester deletion, application assets, team/member management, and broader invitation/email workflows.

## Changed Files

- `src/api/routes/oauth2/applications/#application_id/allowlist/index.ts`
- `src/api/util/utility/ApplicationAuthorization.ts`
- `src/schemas/responses/ApplicationTestersResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/oauth2ApplicationsAllowlistGetRoute.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- Assigned missing entry was present in `packages/missing-routes/missing.json` before implementation:
    - method: `GET`
    - route: `/oauth2/applications/{param}/allowlist`
    - route_name: `GET_OAUTH2_APPLICATIONS_APPLICATION_ID_ALLOWLIST`
    - source route: `/oauth2/applications/{application_id}/allowlist`
    - summary: `Get Application Testers`
- Source catalog initially only had adjacent `DELETE /oauth2/applications/{application_id}/allowlist/{user_id}`.
- Userdoccers source: `https://docs.discord.food/resources/application`, section `Get Application Testers`, documents:
    - `GET /oauth2/applications/{application.id}/allowlist`
    - response as a list of whitelisted user objects with `user` partial user and `state`
    - states `1 INVITED`, `2 ACCEPTED`
    - access by application owner or owning-team member
- xHyroM source catalog did not contain this GET route; it only had `/oauth2/allowlist/accept` entries near this area.
- Existing adjacent delete route established malformed application ID handling and `ACTION_NOT_AUTHORIZED_ON_APPLICATION` -> HTTP `403` mapping.
- Existing `ApplicationTester` entity and migration provided `application_testers` persistence with `application_id`, `user_id`, `state`, and `user` relation.

## What Changed

- Added `ApplicationTesterResponse` / `ApplicationTestersResponse` schemas.
- Added read-side authorization helpers:
    - `canAccessApplicationTesters`
    - `requireApplicationTesterAccess`
- Added route implementation at `src/api/routes/oauth2/applications/#application_id/allowlist/index.ts`.
- Added focused tests covering:
    - route metadata
    - owner access
    - accepted read-only team member access
    - invited/non-team rejection before tester lookup
    - unknown and malformed application IDs
    - tester partial-user serialization
    - generated schema/source/OpenAPI/manifest/contract/coverage/missing metadata
- Regenerated source catalog, missing report, schemas, OpenAPI, testing manifest, HTTP contracts, and suite coverage.

## Missing-Route Movement

- Before: `Spacebar is missing 660`
- After regeneration: `Spacebar is missing 659`
- The assigned `GET /oauth2/applications/{param}/allowlist` entry is absent from `packages/missing-routes/missing.json`.
- The adjacent `POST /oauth2/applications/{param}/allowlist` entry remains present and intentionally unimplemented.
- Source catalog now contains `GET /oauth2/applications/{application_id}/allowlist` from `src/api/routes/oauth2/applications/#application_id/allowlist/index.ts`.
- Testing manifest now contains `api:http:GET:/oauth2/applications/:application_id/allowlist/`.

## Commands Run

- `npm run build:src:tsgo`
    - First run failed before code checking because this worktree had no `node_modules`: `error TS2688: Cannot find type definition file for 'node'`.
- `npm ci`
    - Installed locked dependencies in the assigned worktree. No package or lockfile diff.
- `npm run build:src:tsgo`
    - Passed.
- `npm run generate:schema`
    - Passed; wrote 1001 schemas, including `ApplicationTestersResponse`.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
    - Passed.
- `npm run build --workspace @spacebar/missing-routes`
    - Passed.
- `npm run generate:openapi`
    - Passed; wrote 415 paths and 1001 schemas. Existing webhook route-metadata warnings remained unrelated.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - Passed.
- `npm run start --workspace @spacebar/missing-routes`
    - Passed; wrote missing report with 659 missing routes.
- `npm run generate:testing-manifest`
    - Passed.
- `node scripts/testing-manifest/verify.js`
    - Passed after regenerating manifest post-formatting.
- `npm run generate:contract-tests`
    - Passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`
    - Passed.
- `npm run generate:suite-coverage`
    - Passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
    - Passed.
- `npm run build:test-fixtures`
    - Passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/oauth2ApplicationsAllowlistGetRoute.test.js`
    - Passed: 9 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
    - Passed: 13 tests.
- `npm run test:contracts:runtime`
    - Failed on pre-existing unrelated public response-schema case: `api:http:GET:/discovery/search` returned `500` instead of expected `200`.
    - Passing portions before the failure included missing bearer token rejection, malformed bearer token rejection, public auth-boundary checks, public request-body checks, and CDN generated contract checks.
    - The new OAuth allowlist GET route was not the failing route.
- `npx prettier --write 'src/api/routes/oauth2/applications/#application_id/allowlist/index.ts' test/routes/oauth2ApplicationsAllowlistGetRoute.test.ts`
    - Applied formatting.
- `npx prettier --check 'src/api/routes/oauth2/applications/#application_id/allowlist/index.ts' src/api/util/utility/ApplicationAuthorization.ts src/schemas/responses/ApplicationTestersResponse.ts src/schemas/responses/index.ts test/routes/oauth2ApplicationsAllowlistGetRoute.test.ts`
    - Passed.
- `npx eslint 'src/api/routes/oauth2/applications/#application_id/allowlist/index.ts' src/api/util/utility/ApplicationAuthorization.ts src/schemas/responses/ApplicationTestersResponse.ts src/schemas/responses/index.ts test/routes/oauth2ApplicationsAllowlistGetRoute.test.ts`
    - Passed.
- `git diff --check`
    - Passed.
- `git diff --name-only -- package.json package-lock.json 'apps/*/package.json' 'packages/*/package.json'`
    - Passed with no output.
- Changed-file malformed warranty-token scan
    - Passed with no malformed warranty tokens in changed files.
- Global malformed warranty-token scan found pre-existing unrelated malformed headers in untouched files such as `src/schemas/responses/PaymentSourceResponse.ts`, `src/api/util/handlers/InviteAcceptance.ts`, and others. They were not changed to avoid unrelated license boilerplate churn.

## Artifact Status

- `assets/schemas.json`: regenerated with `ApplicationTesterResponse`, `ApplicationTestersResponse`, and `ApplicationTesterState`.
- `assets/openapi.json`: regenerated with `GET /oauth2/applications/{application_id}/allowlist/`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: regenerated with the GET source route.
- `packages/missing-routes/missing.json`: regenerated; assigned GET removed, adjacent POST retained.
- `assets/testing-manifest.json`: regenerated and verified.
- `test/generated/http-contracts.json`: regenerated and verified.
- `test/generated/suite-coverage.json`: regenerated and verified.

## Risks And Blockers

- `npm run test:contracts:runtime` still fails on the existing unrelated `api:http:GET:/discovery/search` response-schema case returning `500` instead of `200`.
- Global warranty-token scan still reports pre-existing malformed headers in untouched files; changed files are clean.
- The implementation does not create or mutate tester invitations. It only reads existing `ApplicationTester` rows, which is in scope for this GET route.

## Recommended Next Tasks

- Implement the still-missing adjacent `POST /oauth2/applications/{application_id}/allowlist` route in a separate assignment.
- Fix the unrelated generated runtime contract failure for `GET /discovery/search`.
- Consider a dedicated cleanup for pre-existing malformed license warranty lines outside missing-route work.
