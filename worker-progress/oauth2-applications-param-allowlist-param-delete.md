# DELETE /oauth2/applications/{param}/allowlist/{param}

## Summary

Implemented `DELETE /oauth2/applications/{application_id}/allowlist/{user_id}` for removing an application tester. The route validates snowflake params, requires the application owner, owning team owner, or an accepted team admin/developer, deletes a matching tester row, returns `204` on success, maps unauthorized access to `403`, unknown applications to `404`, and absent or malformed tester user IDs to `404 Unknown User`.

This adds only the minimal persistence needed by the DELETE route: an `application_testers` entity/table with `application_id`, `user_id`, and tester `state`. Adjacent tester list/add/accept routes remain unimplemented.

## Changed Files

- `src/api/routes/oauth2/applications/#application_id/allowlist/#user_id.ts`
- `src/api/util/utility/ApplicationAuthorization.ts`
- `src/util/entities/ApplicationTester.ts`
- `src/util/entities/index.ts`
- `src/util/migration/postgres/1778511000000-ApplicationTesters.ts`
- `test/routes/oauth2ApplicationsAllowlistDeleteRoute.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `assets/openapi.json`
- `worker-progress/oauth2-applications-param-allowlist-param-delete.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` had one assigned missing entry before implementation:
    - `DELETE /oauth2/applications/{param}/allowlist/{param}`
    - `route_name`: `DELETE_OAUTH2_APPLICATIONS_APPLICATION_ID_ALLOWLIST_USER_ID`
    - source: `userdoccers:resources/application.mdx`
    - source route: `/oauth2/applications/{application_id}/allowlist/{user_id}`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` had no source route for this path before implementation.
- Userdoccers application docs describe the application tester remove route as `204` success and limited to the application owner or a developer of the owning team.
- Existing application command, emoji, branch, and gift-code batch helpers centralize owner/team access under `src/api/util/utility/ApplicationAuthorization.ts`; tester management follows that pattern but excludes the application bot user.

## Assigned Path

- Assigned path: `/oauth2/applications/{param}/allowlist/{param}`
- Missing methods found: `DELETE`
- Methods implemented: `DELETE`
- Adjacent routes intentionally not implemented: `GET /oauth2/applications/{application_id}/allowlist`, `POST /oauth2/applications/{application_id}/allowlist`, `POST /oauth2/allowlist/accept`, application asset routes, broader tester invitation side effects, and application team/member management.

## Missing-Route Movement

- Current integration base before regeneration: `missing: 664`, `spacebar: 516`, `discord: 1128`.
- Current integration base after regeneration: `missing: 663`, `spacebar: 517`, `discord: 1128`.
- The assigned `DELETE /oauth2/applications/{param}/allowlist/{param}` entry is absent from `packages/missing-routes/missing.json`.
- Source catalog now contains `DELETE /oauth2/applications/{application_id}/allowlist/{user_id}` from `src/api/routes/oauth2/applications/#application_id/allowlist/#user_id.ts`.

## Commands Run

- `npm run build:src:tsgo`
- `npx eslint src/api/routes/oauth2/applications/#application_id/allowlist/#user_id.ts src/api/util/utility/ApplicationAuthorization.ts src/util/entities/ApplicationTester.ts src/util/entities/index.ts src/util/migration/postgres/1778511000000-ApplicationTesters.ts test/routes/oauth2ApplicationsAllowlistDeleteRoute.test.ts`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/oauth2ApplicationsAllowlistDeleteRoute.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` (reported stale contracts after the new route)
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check` (reported stale suite coverage after the new route)
- `npm run generate:suite-coverage`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/generated/http-auth-runtime-contracts.test.js` (failed on unrelated `GET /discovery/search` returning `500` instead of `200`)
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx prettier --check src/api/routes/oauth2/applications/#application_id/allowlist/#user_id.ts src/api/util/utility/ApplicationAuthorization.ts src/util/entities/ApplicationTester.ts src/util/entities/index.ts src/util/migration/postgres/1778511000000-ApplicationTesters.ts test/routes/oauth2ApplicationsAllowlistDeleteRoute.test.ts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json tsconfig.test.json`
- Conflict-marker scans over changed files with `rg`
- Changed-file malformed warranty-token scans with `rg`

## Verification Notes

- `npm run build:src:tsgo` passed.
- `npm run build:test-fixtures` passed.
- Focused compiled route/auth/migration test passed: 10 tests, 0 failures. An initial focused test rerun exposed an assertion comparing duplicate module instances of a Discord error; the assertion now checks the error code and the behavior passed unchanged.
- Focused ESLint and Prettier checks passed.
- Automatic reverse-engineering package build and source import passed.
- Missing-routes package build/start passed and wrote `Spacebar is missing 663`, `Spacebar implements 517`, `Discord implements 1128`.
- Testing manifest verified: 622 entries.
- Generated HTTP contracts verified: 597 contracts.
- Generated suite coverage verified after regeneration: 15 suites.
- `npm run generate:openapi` wrote `assets/openapi.json` with 411 paths and 997 schemas and included `DELETE /oauth2/applications/{application_id}/allowlist/{user_id}/`. Existing webhook metadata warnings remain outside this assignment.
- Generated HTTP contract and suite coverage tests passed: 13 tests, 0 failures.
- Generated runtime auth contracts passed bearer-auth, malformed-token, public-auth-boundary, CDN, and upload checks before failing on the pre-existing unrelated public response-schema case `api:http:GET:/discovery/search` returning `500` instead of `200`; the new OAuth allowlist route was not the failing route.
- `npm run test:manifest` passed 30 tests plus manifest verification.
- `npm run test:suite-coverage` passed 4 tests.
- Package/lockfile/tsconfig guard showed no package, lockfile, workspace package, or `tsconfig.test.json` changes.
- Conflict-marker and changed-file malformed warranty-token scans returned no matches.
- `npm run generate:schema` was not run because no schema files changed.

## Prompt-To-Artifact Audit

- Confirmed missing entry and absence in source catalog/routes: done.
- Compared Userdoccers only as needed: done.
- Inspected existing OAuth/application owner/team authorization patterns: done.
- Implemented exactly `DELETE /oauth2/applications/{param}/allowlist/{param}`: done.
- Added minimal tester persistence for the assigned delete operation: done.
- Added focused route, authorization, and migration tests: done.
- Regenerated source catalog, missing report, testing manifest, HTTP contracts, suite coverage, and OpenAPI: done.
- Ran required builds, focused tests, generated tests, and hygiene guards: done.
- Did not implement adjacent tester, asset, or allowlist acceptance routes: confirmed.

## Risks / Blockers

- `application_testers` is intentionally minimal. The route can remove stored testers, but add/list/accept invitation flows remain missing and will need to reuse or extend the same table.
- Missing tester rows currently return `404 Unknown User`; Userdoccers does not document a more specific error body for that case.
- No gateway, email, or invitation-token side effects are implemented because this DELETE route only removes an existing tester row.

## Recommended Next Tasks

- Implement tester list/add and invitation acceptance routes separately when assigned.
- Decide whether add/list should expose tester state through a shared response schema.
