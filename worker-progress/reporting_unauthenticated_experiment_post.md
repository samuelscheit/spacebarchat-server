# POST /reporting/unauthenticated/experiment

## Summary

- Implemented only the assigned `POST /reporting/unauthenticated/experiment` method.
- Kept the route public through `NO_AUTHORIZATION_ROUTES`, matching the unauthenticated route name.
- Added a local fail-closed `501 APIErrorResponse` implementation because Spacebar has no durable Discord DSA experiment, unauthenticated verification, or unauthenticated report-submission provider to truthfully record experiment state.
- Left the existing `GET /reporting/unauthenticated/experiment` empty eligibility response unchanged.

## Assigned Scope

- Worker id: `reporting_unauthenticated_experiment_post`
- Assigned route: `POST /reporting/unauthenticated/experiment`
- Assigned route name: `DSA_EXPERIMENT_UNAUTHENTICATED`
- Source: `xhyrom:data/client/routes.json`
- Method-scoped assignment: only POST was implemented.

## Evidence Gathered

- `packages/missing-routes/missing.json` at base `c32b7c79b` had exactly one same-path missing entry:
    - `POST /reporting/unauthenticated/experiment`, route name `DSA_EXPERIMENT_UNAUTHENTICATED`, source `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had only:
    - `GET /reporting/unauthenticated/experiment`, route name `GET_REPORTING_UNAUTHENTICATED_EXPERIMENT`, response `ReportingUnauthenticatedExperimentResponse`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `GET`, `HEAD`, `OPTIONS`, and `POST` for `/reporting/unauthenticated/experiment` under `DSA_EXPERIMENT_UNAUTHENTICATED`; `HEAD` and `OPTIONS` are ignored by the missing-route tool and were outside this method-scoped assignment.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` and https://docs.discord.food/topics/reports document only the GET eligibility query for this exact path, returning an empty object on success.
- Existing `src/api/routes/reporting/index.ts` documents the local limitation: Spacebar does not yet implement the DSA email verification and unauthenticated submission flow.

## Changed Files

- `src/api/routes/reporting/unauthenticated/experiment.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/api/middlewares/Authentication.test.ts`
- `src/api/tests/reporting/unauthenticatedExperiment.test.ts`
- Generated artifacts:
    - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - `packages/missing-routes/missing.json`
    - `assets/openapi.json`
    - `assets/testing-manifest.json`
    - `test/generated/http-contracts.json`

## Behavior

- `POST /reporting/unauthenticated/experiment` is public.
- The default implementation throws `ApiError(UNAUTHENTICATED_DSA_EXPERIMENT_UNSUPPORTED_MESSAGE, 0, 501)`.
- OpenAPI, testing manifest, and generated contracts declare `501` with `APIErrorResponse`.
- This avoids accepting, persisting, or fabricating unsupported DSA experiment state.

## Missing-Route Movement

- Base report at `c32b7c79b`:
    - `missing`: 513
    - `spacebar`: 667
    - exact same-path missing entries: the assigned POST entry was present.
- Regenerated report:
    - `missing`: 512
    - `spacebar`: 668
    - exact same-path missing entries: `[]`
- Source catalog now contains both GET and POST entries for `/reporting/unauthenticated/experiment`.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci` passed; needed because this worktree had no installed dependencies. Package/lockfile guard later confirmed no package or lockfile diff.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` passed after install; rerun after formatting and passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` passed and wrote `1201` schemas.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` passed and wrote `Spacebar is missing 512`, `Spacebar implements 668`, `Discord implements 1128`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` passed and wrote `551` paths and `1201` schemas. Existing webhook route-middleware warnings remained.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` passed and wrote `773` entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js` passed after final manifest regeneration.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` passed and wrote `748` contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` passed; suite coverage files had no final diff.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` passed.
- Focused compiled tests passed, 26/26:
    - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/middlewares/Authentication.test.js dist-test/src/api/tests/reporting/unauthenticatedExperiment.test.js`
- Generated contract/suite tests passed, 13/13:
    - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/middlewares/Authentication.test.ts src/api/middlewares/NoAuthorizationRoutes.ts src/api/routes/reporting/unauthenticated/experiment.ts src/api/tests/reporting/unauthenticatedExperiment.test.ts` passed.
- Prettier check passed for touched TS and generated JSON artifacts.
- `git diff --check` passed.
- `git diff --cached --check` passed.
- Package/lockfile guard passed:
    - `git diff --exit-code -- package.json package-lock.json npm-shrinkwrap.json yarn.lock pnpm-lock.yaml bun.lock`
- Malformed warranty-token scan passed for changed TS files.

## Contract Runtime Note

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` failed only in runtime public response-schema validation for the known unrelated route:
    - `api:http:GET:/discovery/search` returned `500 !== 200`.
- The generated contract checks before runtime passed, and this failure is unrelated to the assigned reporting route.

## Sibling Routes Intentionally Untouched

- `GET /reporting/unauthenticated/experiment` behavior remains the existing `{}` response.
- `GET /reporting/unauthenticated/capabilities` was not changed.
- `GET /reporting/unauthenticated/menu/{type}` was not changed.
- `POST /reporting/unauthenticated/{param}` was not implemented.
- `POST /reporting/unauthenticated/{param}/code` was not implemented.
- `POST /reporting/unauthenticated/{param}/verify` was not implemented.
- `POST /reporting/review` was not implemented.

## Reconciliation Notes

- `assets/testing-manifest.json` and `test/generated/http-contracts.json` also updated generated line numbers for an existing unrelated route, `src/api/routes/applications/#application_id/activities/#instance_location_id/instances/#instance_instance_id/leave.ts`. This came from the generator and is required for `node scripts/testing-manifest/verify.js` to pass.
- No package files or lockfiles changed after `npm ci`.

## Risks And Blockers

- The route is intentionally a compatibility/fail-closed implementation, not a full DSA experiment provider.
- A future complete implementation needs durable unauthenticated DSA experiment state and the broader unauthenticated verification/submission flow.

## Recommended Next Tasks

- Implement the separately missing unauthenticated reporting flow routes when a real provider and persistence model are available.
- Resolve the unrelated `GET /discovery/search` runtime contract `500 !== 200` failure so full `npm run test:contracts` can pass.
