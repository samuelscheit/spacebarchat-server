# PATCH /users/@me/library/{param}/{param}

## Summary

Accepted the worker implementation for the method-scoped `PATCH /users/@me/library/{application_id}/{branch_id}` route on the current integration base. The route validates the body with `LibraryApplicationBranchModifySchema`, validates both route IDs as snowflake-shaped values, and then fails closed with a `501` API error because Spacebar does not currently persist Discord user-library application branch state or per-user library flags.

The sibling `DELETE /users/@me/library/{param}/{param}` and `POST /users/@me/library/{param}/{param}/installed` routes remain intentionally unimplemented.

## Changed Files

- `src/api/routes/users/@me/library.ts`
    - Added `PATCH /:application_id/:branch_id`.
    - Added exported helpers for route ID validation and unsupported update error construction.
    - Declared `LibraryApplicationBranchModifySchema` request body and `APIErrorResponse` responses for `400`, `401`, `404`, and `501`.
- `src/schemas/uncategorised/LibraryApplicationBranchModifySchema.ts`
    - Added optional nonnegative integer `flags`.
- `src/schemas/uncategorised/index.ts`
    - Exported the new schema.
- `test/routes/users-me-library-application-branch-patch.test.ts`
    - Added focused coverage for auth, body validation, ID validation, fail-closed behavior, generated artifacts, and assigned missing-route removal.
- `testing/suite-coverage-policy.json`
    - Added the focused route test to the users suite.
- Regenerated `assets/schemas.json`, `assets/openapi.json`, `assets/testing-manifest.json`, `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`, `packages/missing-routes/missing.json`, `test/generated/http-contracts.json`, and `test/generated/suite-coverage.json`.

## Evidence

- Local xHyroM route catalog listed `PATCH`, `DELETE`, and `OPTIONS` for `/users/@me/library/{param}/{param}`.
- `discord.py-self` exposes `edit_library_entry(application_id, branch_id, payload)` as `PATCH /users/@me/library/{application_id}/{branch_id}` and sends a `flags` bitfield payload.

## Missing Route Movement

- Current integration base: `ffeed4b0a`
- `packages/missing-routes/missing.json`
    - `missing`: `477 -> 476`
    - `spacebar`: `703 -> 704`
    - `discord`: `1128`
- Removed only:
    - `PATCH /users/@me/library/{param}/{param}` (`LIBRARY_APPLICATION_BRANCH`)
- Still missing by design:
    - `DELETE /users/@me/library/{param}/{param}` (`LIBRARY_APPLICATION_BRANCH`)
    - `POST /users/@me/library/{param}/{param}/installed` (`LIBRARY_APPLICATION_INSTALLED`)

## Verification

- `npm run build:src:tsgo` passed.
- `npm run generate:schema` passed.
- `npm run generate:openapi` passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed and reported `Spacebar is missing 476`, `Spacebar implements 704`, `Discord implements 1128`.
- `npm run generate:testing-manifest` passed.
- `npm run generate:contract-tests` passed.
- `npm run generate:suite-coverage` passed.
- `npm run build:test-fixtures` passed.
- Focused built route tests passed: `dist-test/test/routes/users-me-library-application-branch-patch.test.js` and `dist-test/test/fixtures/users-library-route.test.js`.
- `npm run test:manifest` passed.
- `npm run test:suite-coverage` passed.
- Targeted ESLint passed.
- `git diff --check` passed.
- Package/lockfile guard passed.
- `npm run test:contracts` passed generated/static checks and failed only on the known unrelated `api:http:GET:/discovery/search` runtime case returning `500 !== 200`.

## Risks

- Spacebar has no durable user-library or commerce entitlement state for Discord library branch records. The route therefore validates and fails closed with `501` instead of fabricating a successful update.
