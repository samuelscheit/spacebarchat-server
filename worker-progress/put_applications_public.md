# PUT /applications/public

## Summary

Accepted the worker implementation for the method-scoped `PUT /applications/public` route on the current integration base. The route is bearer-authenticated and fails closed with a `501` API error because the only PUT evidence is the xHyroM client route catalog; Userdoccers documents the adjacent GET route but does not define PUT request fields, response shape, mutation semantics, persistence, gateway events, or audit behavior.

Sibling `GET /applications/public` remains intentionally unimplemented. Existing `PATCH /applications/public` behavior is preserved.

## Changed Files

- `src/api/routes/applications/public.ts`
    - Added `APPLICATIONS_PUBLIC_PUT_UNSUPPORTED_MESSAGE` and `createApplicationsPublicPutUnsupportedError()`.
    - Added `PUT /` with `401` and `501` `APIErrorResponse` metadata.
- `test/routes/applications-public-put.test.ts`
    - Added focused coverage for auth, fail-closed response, unsupported error helper, generated artifacts, and assigned missing-route removal.
- `test/routes/applications-public-patch.test.ts`
    - Updated sibling-route expectations now that PUT is implemented.
- Regenerated `assets/openapi.json`, `assets/testing-manifest.json`, `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`, `packages/missing-routes/missing.json`, `test/generated/http-contracts.json`, and `test/generated/suite-coverage.json`.

## Evidence

- `packages/missing-routes/missing.json` listed assigned `PUT /applications/public` before replay.
- xHyroM lists `PUT /applications/public` with route name `APPLICATIONS_PUBLIC`.
- Userdoccers documents only `GET /applications/public` / `Get Partial Applications`; no source-backed PUT semantics were found.
- Existing local `PATCH /applications/public` is a fail-closed compatibility route for unsupported public application bulk mutation.

## Missing Route Movement

- Current integration base: `6fc8505d2`
- `packages/missing-routes/missing.json`
    - `missing`: `474 -> 473`
    - `spacebar`: `706 -> 707`
    - `discord`: `1128`
- Removed only:
    - `PUT /applications/public` (`APPLICATIONS_PUBLIC`)
- Still missing by design:
    - `GET /applications/public` (`APPLICATIONS_PUBLIC`)

## Verification

- `npm run build:src:tsgo` passed.
- `npm run generate:openapi` passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed and reported `Spacebar is missing 473`, `Spacebar implements 707`, `Discord implements 1128`.
- `npm run generate:testing-manifest` passed with `812` entries.
- `npm run generate:contract-tests` passed with `787` contracts.
- `npm run generate:suite-coverage` passed.
- `npm run build:test-fixtures` passed.
- Focused built public application tests passed: `applications-public-put`, `applications-public-patch`, and `applications-public` (`19/19`).
- `npm run test:manifest` passed.
- `npm run test:suite-coverage` passed.
- Targeted ESLint passed.
- License typo scan passed.
- `git diff --check` passed.
- Package/lockfile guard passed.
- `npm run test:contracts` passed generated/static checks and failed only on the known unrelated `api:http:GET:/discovery/search` runtime case returning `500 !== 200`.
