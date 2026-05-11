# storefront_products_sku_param_get

## Summary

Implemented `GET /storefront/products/sku/{sku_id}` for
`GET_STOREFRONT_PRODUCTS_SKU_SKU_ID`.

The route stays behind bearer auth, validates SKU IDs as snowflakes, returns
provider-backed `StorefrontProductResponse` data, and fails closed with
`Unknown Product` (`10987`, 404) for malformed, unbacked, or SKU/product
mismatched data. Spacebar still has no durable Discord storefront product/SKU
catalog, so the default provider returns `undefined` rather than fabricating
Discord storefront data.

The accepted current-base port also extracted storefront product cloning and
lookup helpers into `src/api/util/utility/StorefrontProductRoute.ts` so the new
SKU route can reuse product response behavior without importing another route
module during OpenAPI route discovery.

## Assigned Scope

- Assigned path: `/storefront/products/sku/{param}`.
- Source route: `/storefront/products/sku/{sku_id}`.
- Route name: `GET_STOREFRONT_PRODUCTS_SKU_SKU_ID`.
- Implemented method: `GET`.
- Source used: Userdoccers `resources/store.mdx`.
- Adjacent routes not implemented: `/storefront/products/skus`,
  `/storefront/skus/prices`, store SKU, purchase, collection, partner SDK,
  guild storefront, billing, entitlement, and collectibles routes.

## Changed Files

- `src/api/util/utility/StorefrontProductRoute.ts`
- `src/api/routes/storefront/products/#product_id.ts`
- `src/api/routes/storefront/products/sku/#sku_id.ts`
- `test/routes/storefront-products-param-route.test.ts`
- `test/routes/storefront-products-sku-param-route.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`

## Current-Base Artifact Status

- Ported onto integration commit `8b0638b3c`.
- Missing-route report moved `622 -> 621`; implemented route count moved
  `558 -> 559`; Discord route count remained `1128`.
- Assigned `GET /storefront/products/sku/{param}` is absent from
  `missing_entries[]`.
- Previously accepted `GET /updates/{param}` remains absent from
  `missing_entries[]`.
- Testing manifest regenerated with `664` entries.
- HTTP contract matrix regenerated with `639` contracts.
- OpenAPI regenerated with `453` paths and `1055` schemas.
- `assets/schemas.json` unchanged after `npm run generate:schema`.

## Current-Base Commands

- `npm run build:src:tsgo` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` -
  passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote
  `621` missing / `559` implemented / `1128` Discord.
- `npm run generate:testing-manifest` - passed; wrote `664` entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` -
  initially reported stale contracts before regeneration.
- `npm run generate:contract-tests` - passed; wrote `639` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; wrote `453` paths and `1055` schemas
  with existing route-metadata warnings.
- `npm run generate:schema` - passed; no schema diff remained.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/storefront-products-sku-param-route.test.js dist-test/test/routes/storefront-products-param-route.test.js` -
  passed, 9 tests.
- `node --test test/generated/http-contracts.test.js` - passed, 9 tests.
- `node --test test/generated/suite-coverage.test.js` - passed, 4 tests.
- `npm run test:manifest` - passed, 30 tests; manifest verified with `664`
  entries.
- `npm run test:suite-coverage` - passed.
- `npm run test:contracts` - static checks passed with `639` contracts, then
  runtime failed only on the known unrelated `api:http:GET:/discovery/search`
  assertion (`500 !== 200`); existing analytics route-registration warnings
  remain unrelated.
- `npm run lint` - passed.
- `git diff --check` - passed.
- Package/lock/schema guard:
  `git diff -- package.json package-lock.json assets/schemas.json` - no diff.
- Changed-file warranty-token scan found only expected AGPL header lines.

## Risks And Blockers

- The default provider intentionally returns 404 until Spacebar has durable
  storefront product/SKU catalog backing.
- `npm run test:contracts` remains blocked by the unrelated
  `/discovery/search` runtime contract failure.

## Prompt-To-Artifact Audit

- Confirmed the assigned missing entry and route absence before implementation.
- Kept implementation scoped to `/storefront/products/sku/{sku_id}` plus a
  shared helper needed by the adjacent accepted product route.
- Reused the accepted `StorefrontProductResponse` schema and fail-closed
  `Unknown Product` behavior.
- Added focused tests for auth boundary, provider-backed success, malformed and
  unbacked SKU IDs, SKU/product mismatch, generated metadata, and adjacent
  non-ownership.
- Regenerated source catalog, missing report, testing manifest, HTTP
  contracts, suite coverage checks, OpenAPI, and schema output on the current
  base.
