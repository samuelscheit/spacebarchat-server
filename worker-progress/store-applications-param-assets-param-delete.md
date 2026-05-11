# DELETE /store/applications/{param}/assets/{param}

## Summary

Implemented `DELETE /store/applications/{application_id}/assets/{asset_id}` for deleting a persisted application store asset.

The route is bearer-authenticated, validates application and asset IDs, authorizes application owners and accepted owning-team members, deletes the matching `application_store_assets` row, attempts backing CDN file deletion at `/store-assets/{application_id}/{asset_id}`, and returns `204` empty success. Adjacent store asset list/create routes and OAuth asset deletion remain out of scope.

## Changed Files

- `src/api/routes/store/applications/#application_id/assets/#asset_id.ts`
- `src/api/util/utility/ApplicationAuthorization.ts`
- `src/util/entities/ApplicationStoreAsset.ts`
- `src/util/entities/index.ts`
- `src/util/migration/postgres/1778442600000-ApplicationStoreAssets.ts`
- `test/routes/store-application-assets-route.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `assets/openapi.json`
- `worker-progress/store-applications-param-assets-param-delete.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` had exactly one assigned missing entry:
    - `DELETE /store/applications/{param}/assets/{param}`
    - `route_name`: `DELETE_STORE_APPLICATIONS_APPLICATION_ID_ASSETS_ASSET_ID`
    - sources: `userdoccers:resources/store.mdx`, `xhyrom:data/client/routes.json`
    - source routes: `/store/applications/{application_id}/assets/{asset_id}`, `/store/applications/{application_id}/assets/{param}`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` had no existing implementation for this path.
- Userdoccers documents store asset fields and `204` empty success for application store asset deletion by the application owner or owning team member.
- Existing application authorization helpers already model owner and accepted-team-member access for application-adjacent resources.

## Assigned Path

- Assigned path: `/store/applications/{param}/assets/{param}`
- Missing methods found: `DELETE`
- Methods implemented: `DELETE`
- Implemented source route: `/store/applications/{application_id}/assets/{asset_id}`
- Adjacent routes intentionally not implemented: `GET /store/applications/{application_id}/assets`, `POST /store/applications/{application_id}/assets`, `DELETE /oauth2/applications/{application_id}/assets/{asset_id}`, store listings, storefront routes, SKU routes, and broader store asset upload/list behavior.

## Missing-Route Movement

- Worker base movement before this current-base merge: `missing: 665 -> 664`, `spacebar: 515 -> 516`, `discord: 1128`.
- Current integration base before regeneration: `missing: 662`, `spacebar: 518`, `discord: 1128`.
- Current integration base after regeneration: `missing: 661`, `spacebar: 519`, `discord: 1128`.
- The assigned `DELETE /store/applications/{param}/assets/{param}` entry is absent from `packages/missing-routes/missing.json`.
- Source catalog now contains `DELETE /store/applications/{application_id}/assets/{asset_id}` from `src/api/routes/store/applications/#application_id/assets/#asset_id.ts`.

## Commands Run

- `npm run build:src:tsgo`
- `npx eslint 'src/api/routes/store/applications/#application_id/assets/#asset_id.ts' src/api/util/utility/ApplicationAuthorization.ts src/util/entities/ApplicationStoreAsset.ts src/util/entities/index.ts src/util/migration/postgres/1778442600000-ApplicationStoreAssets.ts test/routes/store-application-assets-route.test.ts`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `npm run build --workspace @spacebar/missing-routes`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` (reported stale contracts after the new route)
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/store-application-assets-route.test.js`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx prettier --write ...` and focused Prettier checks for changed source/test/report files
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json tsconfig.test.json`
- Conflict-marker scans over changed files with `rg`
- Changed-file malformed warranty-token scans with `rg`

## Verification Notes

- `npm run build:src:tsgo` passed.
- Focused ESLint passed.
- Automatic reverse-engineering and missing-routes package builds passed.
- Source catalog import passed.
- Missing-routes package start passed and wrote `Spacebar is missing 661`, `Spacebar implements 519`, `Discord implements 1128`.
- Testing manifest verified: 624 entries.
- Generated HTTP contracts verified after regeneration: 599 contracts.
- Generated suite coverage verified without regeneration: 15 suites.
- `npm run generate:openapi` wrote `assets/openapi.json` with 413 paths and 997 schemas and included `DELETE /store/applications/{application_id}/assets/{asset_id}/`. Existing webhook metadata warnings remain outside this assignment.
- `npm run build:test-fixtures` passed.
- Focused compiled store asset route tests passed: 7 tests, 0 failures.
- Generated HTTP contract and suite coverage tests passed: 13 tests, 0 failures.
- `npm run test:manifest` passed 30 tests plus manifest verification.
- `npm run test:suite-coverage` passed 4 tests.
- Package/lockfile/tsconfig guard showed no package, lockfile, workspace package, or `tsconfig.test.json` changes.
- Conflict-marker scans over changed files returned no matches.
- Malformed AGPL warranty-token scans over changed in-scope files returned no matches.
- Optional runtime auth contracts were not rerun during this current-base port; the worker's broad runtime run failed only on the pre-existing unrelated public response-schema case `api:http:GET:/discovery/search` returning `500` instead of `200`.
- `npm run generate:schema` was not run because no schema files changed.

## Prompt-To-Artifact Audit

- Confirmed missing entry and absence in source catalog/routes: done.
- Compared Userdoccers/xHyroM only as needed: done.
- Inspected existing application authorization patterns: done.
- Implemented exactly `DELETE /store/applications/{param}/assets/{param}`: done.
- Added minimal store asset persistence for the assigned delete operation: done.
- Added focused route, helper, authorization, artifact, and error tests: done.
- Regenerated source catalog, missing report, testing manifest, HTTP contracts, and OpenAPI: done.
- Checked suite coverage freshness: done.
- Ran required builds, focused tests, generated tests, and hygiene guards: done.
- Did not implement adjacent store asset, OAuth asset, listing, storefront, SKU, or upload routes: confirmed.

## Risks / Blockers

- `application_store_assets` is intentionally minimal. It supports deletion of stored rows, while list/upload flows remain separate missing-route work.
- The route uses a local `Unknown Store Asset` `ApiError` with code `10046`; the source docs do not document a more specific error body for unknown store assets.
- CDN file deletion is attempted after the persistence row is deleted, matching the worker handoff. If the CDN deletion fails, the route currently surfaces that failure.

## Recommended Next Tasks

- Implement `GET /store/applications/{application_id}/assets` and `POST /store/applications/{application_id}/assets` separately if assigned, reusing the same table.
- Investigate the existing `GET /discovery/search` runtime contract 500 outside this worker scope.
