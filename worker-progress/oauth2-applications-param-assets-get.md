# GET /oauth2/applications/{application_id}/assets

## Summary

Implemented the assigned `GET /oauth2/applications/{param}/assets` route only.

- Ported the scoped worker changes onto current integration base `32204d432` after the worker completed on older base `51722c294`.
- Regenerated generated artifacts from current main rather than copying the worker artifacts, preserving the accepted OAuth application tokens route and channel directory-entry list/search routes.
- Added `src/api/routes/oauth2/applications/#application_id/assets/index.ts`.
- Added `ApplicationAssetsResponse` as an `ApplicationAssetResponse[]` schema.
- Added application asset read access using the same owner/team-member boundary as other developer read routes.
- The handler validates malformed application IDs as unknown applications, checks application access, accepts the documented `nocache` query metadata, and returns a conservative empty asset list because Spacebar does not currently persist Discord's application asset catalog.
- Did not implement adjacent `POST /oauth2/applications/{application_id}/assets`, OAuth token routes, tester allowlist routes, store asset list/create/delete, store asset management, or broader asset persistence.

## Changed Files

- `src/api/routes/oauth2/applications/#application_id/assets/index.ts`
- `src/api/util/utility/ApplicationAuthorization.ts`
- `src/api/util/utility/ApplicationAuthorization.test.ts`
- `src/schemas/responses/ApplicationsWithAssetsResponse.ts`
- `src/schemas/responses/ApplicationsWithAssetsResponse.test.ts`
- `test/routes/oauth2-application-assets-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained `GET /oauth2/applications/{param}/assets` with route name `GET_OAUTH2_APPLICATIONS_APPLICATION_ID_ASSETS`.
- `routes.source.catalog.json` initially had only the adjacent `DELETE /oauth2/applications/{application_id}/assets/{application_asset_id}` route.
- `src/api/routes/oauth2/applications` had allowlist, tokens, and DELETE asset routes, but no `assets/index.ts`.
- Userdoccers application docs: `resources/application.mdx` / `https://docs.discord.food/resources/application`, "Get Application Assets" documents `GET /oauth2/applications/{application.id}/assets`, response as application assets, and optional `nocache` boolean; create/delete are separate adjacent routes.
- xHyroM local route catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `GET/HEAD/OPTIONS/POST /oauth2/applications/{application_id}/assets` as `APPLICATION_ASSETS`.
- Existing `applications-with-assets` route already documents that Spacebar does not persist the application asset catalog, so returning `[]` avoids fabricating CDN metadata.
- OpenAPI now has distinct paths for `GET /oauth2/applications/{application_id}/assets/` and the pre-existing `DELETE /oauth2/applications/{application_id}/assets/{application_asset_id}/`.

## Missing-Route Movement

- Current-main before regeneration: `missing = 654`, `spacebar = 526`.
- After regeneration: `missing = 653`, `spacebar = 527`, `discord = 1128`.
- Assigned GET entry removed from `missing_entries`.
- Adjacent `POST /oauth2/applications/{param}/assets` remains missing.
- Current regenerated artifacts include OAuth application assets, OAuth application tokens, and channel directory-entry list/search.

## Commands Run

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; wrote 1006 schemas including `ApplicationAssetsResponse`.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote `missing.json` with `missing = 653`.
- `npm run generate:testing-manifest` - passed; wrote 632 entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - first reported stale, passed after regenerating contract tests.
- `npm run generate:contract-tests` - passed; wrote 607 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - first reported stale, passed after regenerating suite coverage.
- `npm run generate:suite-coverage` - passed.
- `npm run generate:openapi` - passed; wrote 421 paths and 1006 schemas. Existing webhook route metadata warnings remain unrelated.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/oauth2-application-assets-route.test.js dist-test/src/api/util/utility/ApplicationAuthorization.test.js dist-test/src/schemas/responses/ApplicationsWithAssetsResponse.test.js` - passed, 48 tests.
- `npm run test:manifest` - passed after regenerating stale manifest/contracts.
- `npm run test:contracts` - generated/static contract tests passed, runtime phase failed on unrelated public `GET /discovery/search` returning 500 instead of 200.
- `npm run test:suite-coverage` - passed.
- `git diff --check` - passed.
- `git diff --exit-code -- package.json package-lock.json npm-shrinkwrap.json yarn.lock pnpm-lock.yaml` - passed.
- Touched-file malformed warranty-token scan - no matches.

## Risks And Blockers

- Spacebar still lacks persisted application asset catalog data, so the GET route returns `[]` for authorized applications. This is intentionally conservative and matches existing application-with-assets behavior.
- `npm run test:contracts` runtime failure is outside this route: `api:http:GET:/discovery/search` returned 500 during generated public response-schema contracts. The assigned OAuth2 assets route is authenticated and focused route tests passed.
- Existing OpenAPI generation warnings about webhook routes without `route()` metadata are pre-existing and unrelated.

## Prompt-To-Artifact Audit

- Confirm missing entry and absence: done.
- Compared Userdoccers and xHyroM sources for route, query param, response, and adjacent method boundaries: done.
- Inspected OAuth application routes, asset delete route, and tokens/allowlist read patterns: done.
- Implemented only `GET /oauth2/applications/{application_id}/assets`: done.
- Added focused production behavior tests and schema/artifact assertions: done.
- Regenerated schema, source catalog, missing report, testing manifest, contracts, suite coverage, and OpenAPI: done.
- Verified current-base missing count movement and adjacent POST remains missing: done.
- Ran required build and focused/generated checks, with out-of-scope runtime contract failure documented: done.

## Recommended Next Tasks

- Implement `POST /oauth2/applications/{application_id}/assets` only if separately assigned, likely requiring real asset catalog persistence.
- Investigate the unrelated generated runtime contract failure for public `GET /discovery/search`.
