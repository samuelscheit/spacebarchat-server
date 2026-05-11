# GET /reporting/unauthenticated/experiment

## Summary

- Ported the prior scoped worker attempt onto current integration base `77f3491f0`.
- Implemented only `GET /reporting/unauthenticated/experiment` as a public, no-side-effect eligibility query that returns `{}`.
- Added a typed empty-object response schema and focused tests for the route and the unauthenticated auth boundary.

## Assigned Scope

- Assigned route id: `reporting-unauthenticated-experiment-get`
- Assigned route name: `GET_REPORTING_UNAUTHENTICATED_EXPERIMENT`
- Assigned method and path: `GET /reporting/unauthenticated/experiment`
- Sources: `userdoccers:topics/reports.mdx`, `xhyrom:data/client/routes.json`

## Evidence Gathered

- Current base `packages/missing-routes/missing.json` had two same-path entries before implementation:
    - `GET /reporting/unauthenticated/experiment`, route name `GET_REPORTING_UNAUTHENTICATED_EXPERIMENT`, sources `userdoccers:topics/reports.mdx` and `xhyrom:data/client/routes.json`, summary `Query Unauthenticated Report Eligibility`.
    - `POST /reporting/unauthenticated/experiment`, route name `DSA_EXPERIMENT_UNAUTHENTICATED`, source `xhyrom:data/client/routes.json`.
- Current base `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no entries for `/reporting/unauthenticated/experiment`.
- Current base `src/api/routes/reporting` had only `src/api/routes/reporting/index.ts`; no unauthenticated experiment route existed.
- Userdoccers reports docs state that `GET /reporting/unauthenticated/experiment` queries unauthenticated report eligibility and returns an empty object on success.
    - Raw source checked: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/topics/reports.mdx`
    - Rendered source checked: `https://docs.discord.food/topics/reports`
- xHyroM also lists `HEAD`, `OPTIONS`, and `POST` for the same path under `DSA_EXPERIMENT_UNAUTHENTICATED`, but the active worker assignment is GET-only, so POST was not implemented.

## Changed Files

- `src/api/routes/reporting/unauthenticated/experiment.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/api/middlewares/Authentication.test.ts`
- `src/api/tests/reporting/unauthenticatedExperiment.test.ts`
- `src/schemas/responses/ReportingUnauthenticatedExperimentResponse.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- Generated artifacts after regeneration:
    - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - `packages/missing-routes/missing.json`
    - `assets/schemas.json`
    - `assets/openapi.json`
    - `assets/testing-manifest.json`
    - `test/generated/http-contracts.json`
- `worker-progress/reporting-unauthenticated-experiment-get.md`

## Commands Run

- `npm run build:src:tsgo` passed.
- `npm run generate:schema` passed and wrote `994` schemas.
- `npm run build:test-fixtures` passed.
- Focused compiled tests passed, 24/24: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/middlewares/Authentication.test.js dist-test/src/api/tests/reporting/unauthenticatedExperiment.test.js`.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed and wrote `Spacebar is missing 674`, `Spacebar implements 506`, and `Discord implements 1128`.
- `npm run generate:testing-manifest` passed and wrote `611` entries.
- `node scripts/testing-manifest/verify.js` passed and verified `611` entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check` initially reported stale; `npm run generate:contract-tests && node scripts/testing-manifest/generate-contract-tests.js --check` passed and wrote `586` contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed; suite coverage files had no final diff for this route.
- `npm run generate:openapi` passed and wrote `411` paths and `994` schemas. Remaining route-middleware warnings are pre-existing webhook warnings.
- Generated contract/suite tests passed, 13/13: `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`.
- Direct artifact checks passed: missing report leaves only POST for `/reporting/unauthenticated/experiment`, source catalog contains the GET response `ReportingUnauthenticatedExperimentResponse`, and the testing manifest contains public `api:http:GET:/reporting/unauthenticated/experiment/` with response status `200`.
- Focused ESLint passed for touched TS files.
- Prettier `--check` passed for touched source, test, report, and generated JSON files.
- `git diff --check` and `git diff --cached --check` passed.
- Package/lockfile guard passed with no changes to `package.json`, `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock`, `pnpm-lock.yaml`, or `bun.lock`.
- Malformed warranty-token scan passed for changed source/test TS files.

## Missing Count Movement

- Current-base before count: `675`.
- After regeneration: `674`; `GET /reporting/unauthenticated/experiment` is implemented and removed from `missing_entries`.
- Remaining same-path missing entry: `POST /reporting/unauthenticated/experiment` from `xhyrom:data/client/routes.json`.

## Artifact Status

- Source catalog contains exactly one assigned-path entry: `GET /reporting/unauthenticated/experiment`, source `src/api/routes/reporting/unauthenticated/experiment.ts`, response `ReportingUnauthenticatedExperimentResponse`.
- `assets/testing-manifest.json` contains `api:http:GET:/reporting/unauthenticated/experiment/` as a public route and no POST entry for this path.
- `test/generated/http-contracts.json` contains one contract for `api:http:GET:/reporting/unauthenticated/experiment/` and no POST contract for this path.
- `assets/openapi.json` contains `get` only for `/reporting/unauthenticated/experiment/`.
- `assets/schemas.json` contains `ReportingUnauthenticatedExperimentResponse` as an object with `additionalProperties: false`.

## Risks And Blockers

- No blocker for the assigned GET route.
- Same-path POST is broader than the explicit GET-only route assignment and remains unimplemented.
- Spacebar returns a static successful empty object and does not implement Discord experiment bucketing or tracking for this query.

## Recommended Next Tasks

- Assign `POST /reporting/unauthenticated/experiment` separately if that xHyroM-only method should be implemented.
- Implement adjacent unauthenticated reporting routes separately: menu, submit, code, and verify.
