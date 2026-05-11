# store-applications-param-assets-get

## Summary

Implemented `GET /store/applications/{application_id}/assets` on current main by
salvaging only the scoped GET route work from the stale worker output.

## Changed Files

- `src/api/routes/store/applications/#application_id/assets/index.ts`
- `src/schemas/responses/ApplicationStoreAssetsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/store-application-assets-route.test.ts`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Evidence

- Assigned path: `GET /store/applications/{application_id}/assets`
- Missing method found: `GET`
- Implemented method: `GET`
- Missing-route movement after regeneration: `650 -> 649`
- Implemented-route movement after regeneration: `530 -> 531`
- Discord-route count after regeneration: `1128`
- The existing adjacent `DELETE /store/applications/{application_id}/assets/{asset_id}`
  route stayed in scope only for shared focused tests and artifact assertions.
- Remaining adjacent `POST /store/applications/{param}/assets` missing entry stayed
  missing and out of scope.

## Verification

- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/store-application-assets-route.test.js`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx eslint "src/api/routes/store/applications/#application_id/assets/index.ts" src/schemas/responses/ApplicationStoreAssetsResponse.ts src/schemas/responses/index.ts test/routes/store-application-assets-route.test.ts`
- `git diff --check`
- package/lockfile guard
- malformed warranty-token scan over changed files

## Risks

- This route returns persisted store asset metadata for callers authorized on the
  application owner or accepted team. Uploading assets remains out of scope.
- The implementation intentionally omits `application_id` from response items to
  match the existing store asset response shape used by the adjacent route.
