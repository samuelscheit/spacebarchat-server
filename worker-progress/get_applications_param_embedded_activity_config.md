# GET /applications/{param}/embedded-activity-config

## Summary

Implemented the method-scoped route `GET /applications/{param}/embedded-activity-config`.

The route validates the application id, checks owner or accepted owning-team-member access, then returns a 501 `APIErrorResponse` because Spacebar does not currently persist Discord embedded activity config state. `PATCH /applications/{param}/embedded-activity-config` remains intentionally unimplemented.

## Changed Files

- `src/api/routes/applications/#application_id/embedded-activity-config.ts`
- `src/api/routes/applications/#application_id/embedded-activity-config.test.ts`
- `src/api/util/utility/ApplicationAuthorization.ts`
- `tsconfig.test.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had both `GET_APPLICATIONS_APPLICATION_ID_EMBEDDED_ACTIVITY_CONFIG` and `PATCH_APPLICATIONS_APPLICATION_ID_EMBEDDED_ACTIVITY_CONFIG`.
- `routes.source.catalog.json` had no source route for `/applications/{param}/embedded-activity-config` before implementation.
- Userdoccers `resources/application.mdx` documents the embedded activity config object and GET/PATCH routes, with access limited to the application owner or owning team members.
- `src/util/entities/Application.ts` has no durable `embedded_activity_config` or equivalent persisted config field.

## Missing-Route Movement

- Worker base movement: `497 -> 496` missing; Spacebar implemented `683 -> 684`.
- Removed missing entry: `GET /applications/{param}/embedded-activity-config`.
- Still missing by design: `PATCH /applications/{param}/embedded-activity-config`.

## Verification Results

- PASS: `npm run build:src:tsgo`
- PASS: `npm run build:test-fixtures`
- PASS: focused route test
- PASS: focused `ApplicationAuthorization.test.js`
- PASS: schema/OpenAPI generation
- PASS: testing manifest generation and verification
- PASS: automatic reverse-engineering build and source catalog import
- PASS: generated HTTP contract regeneration
- PASS: generated suite coverage regeneration and verification
- PASS: missing-routes build/start
- PASS: targeted ESLint
- PASS: `git diff --check`
- PASS: package/lockfile guard
- EXPECTED UNRELATED FAILURE: `npm run test:contracts` failed only on known unrelated `api:http:GET:/discovery/search` runtime `500 !== 200`; generated/static contract checks passed first.

## Risks Or Blockers

- Spacebar has no local durable embedded activity config persistence. Returning fabricated config would misrepresent state, so this route fails closed with 501 after access validation.
- The implemented GET route advertises only `APIErrorResponse` statuses in generated metadata until real config persistence/provider support exists.

## Sibling Routes Intentionally Untouched

- `PATCH /applications/{param}/embedded-activity-config`
- Adjacent application embedded activity, proxy config, attachment, and activity instance routes

## Main Checkout Reconciliation

- Replayed the source route, focused test, authorization helper, `tsconfig.test.json`, and handoff report into `/Users/user/Developer/Developer/spacebarchat/server` at base `329e83c9d`.
- Regenerated derived artifacts on the main checkout. Current-base movement: `496 -> 495` missing; Spacebar implemented count `684 -> 685`.
- Main-checkout verification passed: `build:src:tsgo`, OpenAPI generation, automatic reverse-engineering build/import, missing-routes build/start, testing manifest generation, contract generation, suite coverage generation, `build:test-fixtures`, focused route test `7/7`, `ApplicationAuthorization` utility test `39/39`, `test:manifest`, `test:suite-coverage`, contract generation `--check`, `test:public-assets`, targeted ESLint, copyright typo scan, `git diff --check`, and package/lockfile guard.
- `npm run test:contracts` failed only on the known unrelated runtime assertion: `api:http:GET:/discovery/search` returned `500 !== 200`; generated/static contract checks passed first.
