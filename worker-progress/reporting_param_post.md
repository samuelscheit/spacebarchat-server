# reporting_param_post

## Summary

Implemented the assigned `POST /reporting/{param}` route as the existing report-menu submission behavior on a catalog-visible `POST /reporting/:type` Express route. The handler preserves authenticated behavior, validates the `CreateReportSchema` body through the existing route middleware, validates the payload against the locally available report menu, rejects unknown report menu types, and returns the existing local `204` compatibility response without fabricating report persistence.

## Assigned Scope

- Assigned route: `POST /reporting/{param}`
- Assigned route name: `POST_REPORTING_TYPE`
- Implemented method: `POST /reporting/:type`
- Sibling routes intentionally untouched:
  - `POST /reporting/review`
  - `POST /reporting/unauthenticated/{param}`
  - `POST /reporting/unauthenticated/{param}/code`
  - `POST /reporting/unauthenticated/{param}/verify`

## Changed Files

- `src/api/routes/reporting/index.ts`
- `src/api/tests/reporting/reportSubmission.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.catalog.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/reporting_param_post.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` at base `1afa51d72` contained `POST /reporting/{param}` with route name `POST_REPORTING_TYPE`.
- Current `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` now contains `POST /reporting/{type}` with route name `POST_REPORTING_TYPE`, request schema `CreateReportSchema`, and response schema `APIErrorResponse`.
- Current `packages/missing-routes/missing.json` no longer contains the assigned missing entry and no longer lists `/reporting/{param}` in `routes`.
- Missing-route movement: `504 -> 503`; Spacebar implemented count: `676 -> 677`.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/topics/reports.mdx`, Reports V3 "Submit Report Menu".
- xHyroM evidence: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `POST /reporting/{param}` as `SUBMIT_REPORT_MENU`.

## Commands Run

- `npm ci`
- `npm run build:src:tsgo`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `node packages/automatic-reverse-engineering/dist/cli.js import-openapi --input assets/openapi.json --out packages/automatic-reverse-engineering/data/catalogs/routes.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/tests/reporting/reportSubmission.test.js dist-test/src/api/tests/reporting/createReport.test.js dist-test/src/api/tests/reporting/unauthenticatedExperiment.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npm run test:contracts`
- `npx eslint src/api/routes/reporting/index.ts src/api/tests/reporting/reportSubmission.test.ts`
- `git diff --check`
- `git diff -- package.json package-lock.json`

## Verification Results

- Focused reporting tests passed: 22 tests, 0 failures.
- `npm run test:manifest` passed.
- `npm run test:suite-coverage` passed.
- Targeted ESLint passed.
- `git diff --check` passed.
- Package/lockfile guard passed: no `package.json` or `package-lock.json` diff.
- `npm run test:contracts` failed only on the known unrelated runtime assertion:
  - `api:http:GET:/discovery/search should return a successful response for schema validation`
  - Actual `500`, expected `200`

## Main-Branch Reconciliation

- Replayed the route/test/progress changes onto `b7610eb09` and regenerated
  current-base OpenAPI, source route catalog, missing-route report, testing
  manifest, generated HTTP contracts, and suite coverage.
- Current-base movement: missing routes `502 -> 501`, Spacebar implemented
  routes `678 -> 679`, Discord routes `1128`.
- Current-base generated artifacts: testing manifest `784` entries, HTTP
  contracts `759`.
- The prior per-report-type POST OpenAPI entries collapse into
  `POST /reporting/{type}`; behavior remains covered by the same
  `validateCreateReport` path.

## Risks / Blockers

- Spacebar still does not persist moderation report records or create Discord Trust and Safety reports. This route keeps the pre-existing local behavior: validate the menu submission and accept the client signal with `204`, without fabricating a report ID or durable report state.
- The route does not add broader target-resource permission validation for every report-menu type; that would be a larger reporting subsystem task spanning messages, guilds, scheduled events, applications, widgets, and DSA flows.

## Recommended Next Tasks

- Implement durable local moderation report storage if Spacebar wants `POST /reporting/:type` to create local report records rather than compatibility-accept validated signals.
- Address the remaining reporting siblings independently: review, unauthenticated submission, unauthenticated code, and unauthenticated verify.
