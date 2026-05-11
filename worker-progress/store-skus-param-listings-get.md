# store-skus-param-listings-get

## Summary

- Accepted implementation of `GET /store/skus/{param}/listings` on current base `a709bc0ea3778454d2f282339a403c391d911e81`.
- Added bearer-auth route `src/api/routes/store/skus/#sku_id/listings.ts`.
- Extracted shared SKU query, lookup, response, and authorization helpers to `src/api/util/utility/StoreSkuRoute.ts` so nested SKU routes do not import sibling route modules during source/OpenAPI extraction.
- Added `StoreSkuListingsResponse` as an array response and focused coverage for authorization, query parsing, fail-closed SKU lookup, empty local listing behavior, and generated artifacts.

## Assigned Path

- Assigned missing path: `/store/skus/{param}/listings`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Source route: `/store/skus/{sku_id}/listings`
- Route name: `GET_STORE_SKUS_SKU_ID_LISTINGS`

## Behavior

- Requires bearer auth.
- Parses optional `country_code` and `localize` query fields.
- Validates the SKU ID as a route snowflake.
- Verifies a locally/provider-backed SKU exists before returning listings.
- Requires access to the owning application through the existing application owner, bot user, or accepted team member store-access checks.
- Returns provider-backed listing objects when configured, otherwise returns `[]` after SKU ownership is verified.
- Fails closed with `404 Unknown SKU` when Spacebar has no local/provider-backed SKU record.

## Changed Files

- `src/api/routes/store/skus/#sku_id.ts`
- `src/api/routes/store/skus/#sku_id/listings.ts`
- `src/api/util/utility/StoreSkuRoute.ts`
- `src/schemas/responses/StoreSkuListingsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/store-skus-param-listings-route.test.ts`
- `test/routes/store-skus-param-plans-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`

## Evidence

- Userdoccers `resources/store.mdx` documents `GET /store/skus/{sku.id}/listings`, application store access, bot support, response as a list of store listing objects, and `country_code` / `localize` query fields.
- xHyroM catalog includes `/store/skus/{sku_id}/listings`.
- The previous source catalog lacked the exact assigned GET route.
- The regenerated source catalog includes `GET /store/skus/{sku_id}/listings` from `src/api/routes/store/skus/#sku_id/listings.ts` with `StoreSkuListingsResponse` and `APIErrorResponse`.
- The regenerated missing report no longer contains `GET_STORE_SKUS_SKU_ID_LISTINGS`.
- Adjacent store SKU purchase and mutation routes remain missing and out of scope.

## Current-Base Count Movement

- Missing routes: `640 -> 639`
- Implemented Spacebar routes: `540 -> 541`
- Discord routes: `1128`
- Schemas: `1029`
- Testing manifest entries: `646`
- HTTP contracts: `621`
- OpenAPI paths: `436`

## Verification

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes && npm run start --workspace @spacebar/missing-routes` - passed.
- `npm run generate:testing-manifest && node scripts/testing-manifest/verify.js` - passed.
- `npm run generate:contract-tests && node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed with existing unrelated webhook metadata warnings.
- `npm run build:test-fixtures` - passed after final artifact regeneration.
- Focused store tests passed: 44 tests.
- `npm run test:manifest` - passed, 30 tests plus manifest verify.
- `npm run test:suite-coverage` - passed, 4 tests.
- `npm run lint` - passed.
- `git diff --check` - passed.
- Package/lockfile guard - passed; no package or lockfile changes.
- Malformed warranty-token scan over changed files - passed.

## Known Unrelated Failure

- `npm run test:contracts` passed static generation checks and the static generated contract matrix, then failed in runtime coverage on the known unrelated public route case: `api:http:GET:/discovery/search` returned `500 !== 200`.

## Risks

- Spacebar still lacks durable Discord SKU listing persistence. The route intentionally avoids fabricating store listing data.
- Default production behavior for a locally backed SKU is an empty listing array until a real listing provider or persistence layer exists.

## Recommended Next Tasks

- Implement `/store/skus/{param}/purchase` separately.
- Add durable SKU/store listing persistence or a configured listing provider before expecting non-empty default listing responses.
