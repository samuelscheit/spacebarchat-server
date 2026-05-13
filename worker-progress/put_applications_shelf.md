# PUT /applications/shelf

## Summary

Accepted the worker implementation for the method-scoped `PUT /applications/shelf` route on the current integration base. The route is bearer-authenticated and fails closed with the existing application-shelf `501` API error because Spacebar has no durable per-user application shelf state to safely replace.

Pre-existing `PATCH /applications/shelf` is preserved. Sibling `GET /applications/shelf` remains intentionally unimplemented.

## Changed Files

- `src/api/routes/applications/shelf.ts`
    - Added `PUT /` with `401` and `501` `APIErrorResponse` metadata.
    - Reuses `createApplicationsShelfUnsupportedError()` for the fail-closed behavior.
- `test/routes/applications-shelf-patch.test.ts`
    - Extended the existing shelf test to cover both PATCH and PUT auth, fail-closed behavior, generated artifacts, and assigned missing-route removal.
- Regenerated `assets/openapi.json`, `assets/testing-manifest.json`, `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`, `packages/missing-routes/missing.json`, `test/generated/http-contracts.json`, and `test/generated/suite-coverage.json`.

## Evidence

- `packages/missing-routes/missing.json` listed `GET /applications/shelf` and assigned `PUT /applications/shelf` before replay.
- xHyroM lists `/applications/shelf` for `GET`, `HEAD`, `OPTIONS`, `PATCH`, and `PUT` with route name `APPLICATIONS_SHELF`.
- Userdoccers has no `/applications/shelf` entry in the local catalog.
- Existing `PATCH /applications/shelf` documents the same local durability gap for per-user shelf state and already fails closed.

## Missing Route Movement

- Current integration base: `7eb6586ce`
- `packages/missing-routes/missing.json`
    - `missing`: `475 -> 474`
    - `spacebar`: `705 -> 706`
    - `discord`: `1128`
- Removed only:
    - `PUT /applications/shelf` (`APPLICATIONS_SHELF`)
- Still missing by design:
    - `GET /applications/shelf` (`APPLICATIONS_SHELF`)

## Verification

- `npm run build:src:tsgo` passed.
- `npm run generate:openapi` passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed and reported `Spacebar is missing 474`, `Spacebar implements 706`, `Discord implements 1128`.
- `npm run generate:testing-manifest` passed with `811` entries.
- `npm run generate:contract-tests` passed with `786` contracts.
- `npm run generate:suite-coverage` passed.
- `npm run build:test-fixtures` passed.
- Focused built shelf test passed: `dist-test/test/routes/applications-shelf-patch.test.js` (`3/3`).
- `npm run test:manifest` passed.
- `npm run test:suite-coverage` passed.
- Targeted ESLint passed.
- `git diff --check` passed.
- Package/lockfile guard passed.
- `npm run test:contracts` passed generated/static checks and failed only on the known unrelated `api:http:GET:/discovery/search` runtime case returning `500 !== 200`.
