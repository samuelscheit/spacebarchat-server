# GET /oauth2/@me

## Summary

Implemented `GET /oauth2/@me` for current OAuth authorization information.

The route is bearer-authenticated, requires an OAuth-style access token with an application ID, explicit scope claim, and future expiry, rejects normal Spacebar session tokens as invalid OAuth tokens, loads the persisted application, returns authorized scopes and expiry, and includes the public user only when the token has the `identify` scope.

## Changed Files

- `src/api/routes/oauth2/@me.ts`
- `src/api/routes/oauth2/@me.test.ts`
- `src/schemas/responses/OAuthCurrentAuthorizationResponse.ts`
- `src/schemas/responses/OAuthAuthorizeInfoResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/oauth2-me-get.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` had one assigned missing entry before implementation:
    - `GET /oauth2/@me`
    - `route_name`: `GET_OAUTH2__ME`
    - sources: `userdoccers:topics/oauth2.mdx`, `xhyrom:data/client/routes.json`
    - summary: `Get Current Authorization Information`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` had no source route for `/oauth2/@me` before implementation.
- Userdoccers documents the response fields as `application`, `scopes`, `expires`, and optional `user` when the token includes `identify`.
- Existing `GET /oauth2/userinfo` parses OAuth scope claims from `scope`, `scopes`, and `scp`; this route follows that local token-claim pattern.

## Assigned Path

- Assigned path: `/oauth2/@me`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Implemented source route: `/oauth2/@me`
- Adjacent routes intentionally not implemented: OAuth token issuance/revocation, OAuth authorization grant persistence, `/oauth2/userinfo`, `/oauth2/authorize`, `/oauth2/tokens`, application allowlist routes, and OAuth application asset routes.

## Missing-Route Movement

- Worker base movement before this current-base merge: `missing: 677 -> 676`, `spacebar: 503 -> 504`, `discord: 1128`.
- Current integration base before regeneration: `missing: 661`, `spacebar: 519`, `discord: 1128`.
- Current integration base after regeneration: `missing: 660`, `spacebar: 520`, `discord: 1128`.
- The assigned `GET /oauth2/@me` entry is absent from `packages/missing-routes/missing.json`.
- Source catalog now contains `GET /oauth2/@me` from `src/api/routes/oauth2/@me.ts`.

## Commands Run

- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npx eslint src/api/routes/oauth2/@me.ts src/api/routes/oauth2/@me.test.ts src/schemas/responses/OAuthCurrentAuthorizationResponse.ts src/schemas/responses/OAuthAuthorizeInfoResponse.test.ts src/schemas/responses/index.ts`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `npm run build --workspace @spacebar/missing-routes`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
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
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/oauth2/@me.test.js dist-test/src/schemas/responses/OAuthAuthorizeInfoResponse.test.js`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx prettier --check ...` over changed source/test/progress files
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json`
- Conflict-marker scans over changed files with `rg`
- Changed-file malformed warranty-token scans with `rg`

## Verification Notes

- `npm run build:src:tsgo` passed.
- `npm run generate:schema` passed and wrote 998 schemas.
- Focused ESLint passed after fixing one `arrow-body-style` issue in the route handler.
- Automatic reverse-engineering and missing-routes package builds passed.
- Source catalog import passed.
- Missing-routes package start passed and wrote `Spacebar is missing 660`, `Spacebar implements 520`, `Discord implements 1128`.
- Testing manifest verified: 625 entries.
- Generated HTTP contracts verified after regeneration: 600 contracts.
- Generated suite coverage verified after regeneration: 15 suites.
- `npm run generate:openapi` wrote `assets/openapi.json` with 414 paths and 998 schemas and included `GET /oauth2/@me/`. Existing webhook metadata warnings remain outside this assignment.
- `npm run build:test-fixtures` passed.
- Focused compiled OAuth route/schema tests passed: 11 tests, 0 failures.
- Generated HTTP contract and suite coverage tests passed: 13 tests, 0 failures.
- `npm run test:manifest` passed 30 tests plus manifest verification.
- `npm run test:suite-coverage` passed 4 tests.
- Package/lockfile guard showed no package, lockfile, or workspace package changes.
- Conflict-marker scans over changed files returned no matches.
- Malformed AGPL warranty-token scans over changed in-scope files returned no matches.
- Optional runtime auth contracts were not rerun during this current-base port; the worker's broad runtime run failed only on the pre-existing unrelated public response-schema case `api:http:GET:/gifs/suggest/` returning `400` instead of `200`.

## Prompt-To-Artifact Audit

- Confirmed missing entry and absence in source catalog/routes: done.
- Compared Userdoccers/xHyroM only as needed: done.
- Inspected existing OAuth token scope parsing patterns: done.
- Implemented exactly `GET /oauth2/@me`: done.
- Added response schema and focused route/schema tests: done.
- Regenerated schema, source catalog, missing report, testing manifest, HTTP contracts, suite coverage, and OpenAPI: done.
- Ran required builds, focused tests, generated tests, and hygiene guards: done.
- Did not implement OAuth token issuance/revocation, durable authorization grants, userinfo, authorize, tokens, allowlist, or asset routes: confirmed.

## Risks / Blockers

- Spacebar still does not implement full OAuth2 access-token issuance or revocation in this scoped change. This route supports signed bearer tokens that already carry OAuth-style application, scope, and expiry claims.
- Application lookup returns `INVALID_OAUTH_TOKEN` when the token references an unknown application, matching a fail-closed OAuth boundary.

## Recommended Next Tasks

- Implement `/oauth2/token` and `/oauth2/token/revoke` separately with durable authorization grant persistence.
- Consolidate duplicated OAuth token claim parsing across OAuth-adjacent routes if additional OAuth routes use the same scope/expiry claims.
- Investigate the existing `GET /gifs/suggest/` runtime contract failure separately.
