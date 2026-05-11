# storefront_skus_prices_get

## Summary

Implemented `GET /storefront/skus/prices` only.

The route is bearer-authenticated by the existing API middleware, parses documented `sku_ids` and `sku_ids[]` query forms, validates 1-100 storefront SKU snowflakes, and returns:

```json
{ "sku_prices": {} }
```

by default because Spacebar does not currently persist a durable Discord storefront SKU price catalog. A provider hook supports locally backed price data without fabricating Discord prices; responses are filtered to requested SKU IDs and cloned to avoid leaking provider internals.

## Changed Files

- `src/api/routes/storefront/skus/prices.ts`
- `src/schemas/responses/StorefrontSkuPricesResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/storefront-skus-prices-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

Regenerated suite coverage produced no diff.

## Evidence

- Missing entry confirmed before implementation:
  - `packages/missing-routes/missing.json` contained `GET_STOREFRONT_SKUS_PRICES` at `/storefront/skus/prices`.
  - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had nearby storefront product routes but no `/storefront/skus/prices`.
  - `src/api/routes/storefront/**` had product routes only; no `storefront/skus/prices` route existed.
- Source docs:
  - Userdoccers raw `pages/resources/store.mdx` documents `GET /storefront/skus/prices`, required `sku_ids array[snowflake]` for 1-100 IDs, and response `sku_prices map[snowflake, partial subscription prices object]`.
  - Userdoccers `resources/store.mdx` defines subscription prices as `country_prices` plus `payment_source_prices`.
  - Userdoccers raw `pages/resources/payment.mdx` defines unit price fields as `currency`, `amount`, and `exponent`.
  - Local `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` has no storefront SKU prices entry.
- Existing local patterns reused:
  - `src/api/routes/storefront/products/skus.ts` query parsing, auth posture, 1-100 bulk limit, and empty local catalog behavior.
  - `src/api/util/utility/StorefrontProductRoute.ts` snowflake validation.

## Behavior

- `200`: `StorefrontSkuPricesResponse`.
- `400`: `APIErrorResponse` for missing, malformed, or over-limit `sku_ids`.
- `401`: `APIErrorResponse` from bearer auth middleware.
- Default local behavior is fail-closed/empty: no Discord prices are fabricated.

## Current-Base Audit

- Ported onto current integration base `546ee6bf4`.
- Current-base missing-route movement after regeneration: `616 -> 615` missing and `564 -> 565` implemented.
- Assigned `/storefront/skus/prices` missing entry is removed from `packages/missing-routes/missing.json`.
- Source catalog, OpenAPI, schemas, testing manifest, and generated HTTP contracts include `GET /storefront/skus/prices`.
- Current-base verification passed:
  - `npm run build:src:tsgo`
  - `npm run generate:schema`
  - `npm run build --workspace @spacebar/automatic-reverse-engineering`
  - source catalog import
  - `npm run build --workspace @spacebar/missing-routes`
  - `npm run start --workspace @spacebar/missing-routes`
  - `npm run generate:openapi`
  - `npm run generate:testing-manifest`
  - testing manifest verify
  - generated contract and suite coverage regeneration/checks
  - `npm run build:test-fixtures`
  - focused compiled route tests, 6/6
  - generated HTTP contract tests, 10/10
  - generated suite coverage tests, 4/4
  - `npm run test:manifest`, 30/30
  - `npm run test:suite-coverage`
  - `npm run lint`
  - `git diff --check`
  - package/lockfile guard
  - changed-file malformed warranty-token scan
- `npm run test:contracts` passed static/generated contract checks and then failed only on the known unrelated runtime contract for `api:http:GET:/discovery/search` returning `500` instead of `200`; existing analytics `query.ts` route-registration warnings remain unrelated.
