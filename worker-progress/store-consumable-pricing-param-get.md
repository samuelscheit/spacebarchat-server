# store-consumable-pricing-param-get

## Assignment

- Worker id: `store_consumable_pricing_param_get`.
- Assigned path: `/store/consumable/pricing/{param}`.
- Source route: `/store/consumable/pricing/{sku_id}`.
- Route name: `GET_STORE_CONSUMABLE_PRICING_SKU_ID`.
- Missing methods found: one `GET` entry.
- Methods implemented: `GET /store/consumable/pricing/{sku_id}` only.

## Summary

- Added bearer-authenticated consumable SKU pricing route at
  `src/api/routes/store/consumable/pricing/#sku_id.ts`.
- Added `StoreConsumableSkuPricingResponse` and nested price response types.
- Default behavior fails closed with Discord-compatible `Unknown SKU`
  (`10027`, HTTP 404) because Spacebar has no durable consumable pricing
  catalog or provider integration.
- Provider-backed tests prove locally backed typed pricing can be returned
  without leaking provider-only fields.
- Regenerated source catalog, missing report, schemas, OpenAPI, testing
  manifest, and generated HTTP contracts from current base.

## Changed Files

- `src/api/routes/store/consumable/pricing/#sku_id.ts`
- `src/schemas/responses/StoreConsumableSkuPricingResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/store-consumable-pricing-param-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/store-consumable-pricing-param-get.md`

## Evidence

- Current-base `packages/missing-routes/missing.json` contained one exact owned
  entry before regeneration: `GET /store/consumable/pricing/{param}`.
- Current-base source catalog and `src/api/routes/store/**` did not contain a
  consumable pricing route before implementation.
- Userdoccers `resources/store.mdx` documents "Get Consumable SKU Pricing" for
  `/store/consumable/pricing/{sku_id}` and a response body with `price` as a
  SKU price object.
- Nearby store route patterns use bearer auth for SKU and price-tier routes
  unless explicitly listed in `NoAuthorizationRoutes`.

## Artifact Status

- Source catalog now contains `GET /store/consumable/pricing/{sku_id}` with
  response refs `APIErrorResponse` and `StoreConsumableSkuPricingResponse`.
- Missing report moved from `633` missing / `547` implemented to `632` missing /
  `548` implemented; Discord remains `1128`.
- Testing manifest contains 653 entries and includes
  `api:http:GET:/store/consumable/pricing/:sku_id/` with bearer auth and
  statuses `[200, 401, 404]`.
- Generated HTTP contracts contain 628 contracts and include the assigned route.
- OpenAPI contains `/store/consumable/pricing/{sku_id}/` with
  `StoreConsumableSkuPricingResponse`.
- Schemas contain `StoreConsumableSkuPricingResponse`,
  `StoreSkuPriceResponse`, `StoreSkuPremiumPriceMapResponse`, and
  `StoreSkuPremiumPriceResponse`.

## Commands Run On Current Base

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; wrote 1039 schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote
  `632` missing / `548` implemented / `1128` Discord.
- `npm run generate:testing-manifest` - passed; wrote 653 entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` -
  initially stale.
- `npm run generate:contract-tests` - passed; wrote 628 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; wrote 443 paths and 1039 schemas, with
  pre-existing webhook route metadata warnings.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/store-consumable-pricing-param-route.test.js` - passed, 5/5.
- `node --test test/generated/http-contracts.test.js` - passed, 9/9.
- `node --test test/generated/suite-coverage.test.js` - passed, 4/4.
- `npm run test:manifest` - passed, 30/30 plus manifest verify.
- `npm run test:suite-coverage` - passed, 4/4 plus suite coverage check.
- `npm run lint` - passed.
- `npm run test:contracts` - static/generated checks passed, then runtime
  failed only on the known unrelated `GET /discovery/search` response-schema
  case returning `500` instead of `200`; existing analytics `query.ts`
  route-registration noise remains unrelated.
- `git diff --check` - passed.
- Package/lockfile guard - passed; no package or lockfile changes.
- Changed-file malformed warranty-token scan - passed; no malformed tokens
  found.

## Risks And Next Tasks

- Spacebar still has no durable consumable pricing catalog or provider
  integration, so default runtime behavior is a truthful `404 Unknown SKU`.
- A future local catalog or provider integration should populate the provider
  seam with verified consumable SKU price data rather than hard-coding Discord
  prices.
- Triage the pre-existing `/discovery/search` runtime contract failure and
  analytics `query.ts` route-registration noise separately.
