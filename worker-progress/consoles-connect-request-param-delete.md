# DELETE /consoles/connect-request/{param}

## Summary

Implemented the assigned authenticated `DELETE /consoles/connect-request/{nonce}` route for `consoles-connect-request-param-delete` / `DELETE_CONSOLES_CONNECT_REQUEST_NONCE`.

The route returns Discord-compatible `204` empty success for cancelling a console connection request nonce. Userdoccers documents only a nonce path parameter and `204` success, and the paired `POST /consoles/connect-request` plus any console request persistence is explicitly out of this assignment's scope, so this implementation is intentionally idempotent and does not invent broader console link/request state.

## Changed Files

- `src/api/routes/consoles/connect-request/#nonce.ts`
- `test/routes/consolesConnectRequestCancelRoute.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `assets/openapi.json`
- `worker-progress/consoles-connect-request-param-delete.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` had one assigned missing entry before implementation:
    - `DELETE /consoles/connect-request/{param}`
    - `route_name`: `DELETE_CONSOLES_CONNECT_REQUEST_NONCE`
    - sources: `userdoccers:resources/connected-accounts.mdx`, `xhyrom:data/client/routes.json`
    - source route: `/consoles/connect-request/{nonce}`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` had no `/consoles/connect-request` source route before implementation.
- Userdoccers `resources/connected-accounts.mdx` says "Cancel Console Connection Request" cancels a console connection request and returns a `204` empty response on success.
- Local xHyroM catalog has `DELETE /consoles/connect-request/{param}`, route name `CONNECT_REQUEST`, plus adjacent `OPTIONS` entries. Only the `DELETE` missing entry was assigned.
- Nearby local console routes use normal bearer auth unless explicitly exempted; `src/api/middlewares/NoAuthorizationRoutes.ts` does not exempt this path.

## Assigned Path

- Assigned path: `/consoles/connect-request/{param}`
- Missing methods found: `DELETE`
- Methods implemented: `DELETE`
- Implemented source route: `/consoles/connect-request/{nonce}`
- Adjacent routes intentionally not implemented: `POST /consoles/connect-request`, `/consoles/{connection_type}/devices`, `/consoles/xbox/*`, console device command routes, connection OAuth callback/authorize/refresh routes, connected-account lifecycle routes, and broader console request persistence.

## What Changed

- Added `src/api/routes/consoles/connect-request/#nonce.ts`.
- Added route metadata:
    - summary: `Cancel Console Connection Request`
    - `204` empty success
    - `401: APIErrorResponse`
- Kept the route authenticated through normal bearer auth.
- Added focused route tests for:
    - manifest route id declaration
    - `204` empty response
    - route metadata and absence of a `200` response contract
- Regenerated source catalog, missing-route report, testing manifest, generated HTTP contract matrix, and OpenAPI.

## Missing-Route Movement

- Current integration base before regeneration: `missing: 665`, `spacebar: 515`, `discord: 1128`.
- Current integration base after regeneration: `missing: 664`, `spacebar: 516`, `discord: 1128`.
- The assigned `DELETE /consoles/connect-request/{param}` entry is absent from `packages/missing-routes/missing.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` now contains `DELETE /consoles/connect-request/{nonce}` from `src/api/routes/consoles/connect-request/#nonce.ts`.

## Commands Run

- `npm run build:src:tsgo`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` (reported stale contracts after the new route)
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/consolesConnectRequestCancelRoute.test.js`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx eslint src/api/routes/consoles/connect-request/#nonce.ts test/routes/consolesConnectRequestCancelRoute.test.ts`
- `npx prettier --check src/api/routes/consoles/connect-request/#nonce.ts test/routes/consolesConnectRequestCancelRoute.test.ts worker-progress/consoles-connect-request-param-delete.md`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json`
- Conflict-marker scans over changed files with `rg`
- Changed-file malformed warranty-token scans with `rg`

## Verification Notes

- `npm run build:src:tsgo` passed.
- One acceptance rerun of the focused compiled test was started while `npm run build:src:tsgo` was cleaning `dist` and failed with `Cannot find module './Gifs'`; rebuilding test fixtures first resolved it.
- Focused compiled route test passed twice: 3 tests, 0 failures.
- Automatic reverse engineering package build and source import passed.
- Missing-routes package build/start passed and wrote the updated missing report.
- Testing manifest verified: 621 entries.
- Generated HTTP contracts verified: 596 contracts.
- Generated suite coverage verified without regeneration.
- Generated HTTP contract and suite coverage tests passed: 13 tests, 0 failures.
- `npm run test:manifest` passed 30 tests plus manifest verification.
- `npm run test:suite-coverage` passed 4 tests.
- `npm run generate:openapi` wrote `assets/openapi.json` with 410 paths and 997 schemas and included `DELETE /consoles/connect-request/:nonce/`. It still reports pre-existing webhook route metadata warnings outside this assignment.
- Focused ESLint and Prettier checks passed after reformatting the one-line response handler.
- `git diff --check` passed.
- Package/lockfile guard showed no package file changes.
- Conflict-marker scans over changed files returned no matches.
- Malformed AGPL warranty-token scans over changed in-scope files returned no matches.
- `npm run generate:schema` was not run because no schema files changed.

## Prompt-To-Artifact Audit

- Confirmed missing entry and absence in source catalog/routes: done.
- Compared Userdoccers/xHyroM only as needed: done.
- Inspected adjacent console and connection route patterns: done.
- Implemented exactly `DELETE /consoles/connect-request/{param}`: done.
- Added focused production-route tests: done.
- Regenerated source catalog and missing report: done.
- Regenerated testing manifest, HTTP contracts, and OpenAPI: done.
- Checked suite coverage freshness: done.
- Ran required builds and focused/generated tests: done.
- Ran diff, package, and warranty guards: done.
- Did not implement adjacent routes or broader console persistence: confirmed.

## Risks / Blockers

- Spacebar still lacks an assigned implementation for `POST /consoles/connect-request` and any backing store for real console connection request creation. This route is therefore an idempotent compatibility cancel endpoint until that separate work exists.
- The OpenAPI generator still reports unrelated webhook routes without `route()` metadata; this was not introduced by this change.

## Recommended Next Tasks

- Implement `POST /consoles/connect-request` separately if assigned, including source-backed nonce issuance semantics.
- Implement console device command routes separately if assigned.
- Revisit shared console request persistence only when create/send/cancel routes are assigned together or source evidence requires durable state.
