# storefront_products_skus_get

## Summary

Implemented `GET /storefront/products/skus` for
`GET_STOREFRONT_PRODUCTS_SKUS`.

The route stays behind bearer auth, validates `sku_ids` as a required
1-100-item storefront SKU snowflake query list, and returns
`StorefrontProductsBySkuResponse` shaped as `{ products: [...] }`. The default
provider returns an empty local representation because Spacebar does not
currently persist Discord storefront product/SKU catalog data. Provider-backed
products are filtered to products that actually include at least one requested
SKU, deduped by product ID, and deep-cloned through the accepted storefront
product serializer.

## Assigned Scope

- Assigned path: `/storefront/products/skus`.
- Route name: `GET_STOREFRONT_PRODUCTS_SKUS`.
- Implemented method: `GET`.
- Source used: Userdoccers `resources/store.mdx`.
- Adjacent routes not implemented: `/storefront/products/{product_id}`,
  `/storefront/products/sku/{sku_id}`, `/storefront/skus/prices`, store SKU,
  purchase, collection, partner SDK, guild storefront, billing, entitlement,
  and collectibles routes.

## Evidence Gathered

- `packages/missing-routes/missing.json` contained the assigned
  `GET /storefront/products/skus` entry before regeneration.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  and `src/api/routes/storefront/products` had no source implementation for
  `/storefront/products/skus` before this change.
- Userdoccers documents `GET /storefront/products/skus` as returning associated
  storefront product objects for the given SKU IDs, with query parameter
  `sku_ids` array[snowflake] `(1-100)` and response body field `products`
  array[storefront product object].
- Userdoccers does not mark this endpoint as unauthenticated, and adjacent
  accepted storefront product routes use bearer auth.

## Changed Files

- `src/api/routes/storefront/products/skus.ts`
- `src/api/util/utility/StorefrontProductRoute.ts`
- `src/api/routes/storefront/products/sku/#sku_id.ts`
- `src/schemas/responses/StorefrontProductResponse.ts`
- `test/routes/storefront-products-skus-route.test.ts`
- `test/routes/storefront-products-param-route.test.ts`
- `test/routes/storefront-products-sku-param-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/storefront-products-skus-get.md`

## Artifact Status

- Missing-route entries moved `620 -> 619` on the acceptance base; assigned
  entry removed.
- `npm run start --workspace @spacebar/missing-routes` reported
  `Spacebar is missing 619`, `Spacebar implements 561`,
  `Discord implements 1128`.
- Source catalog now has `GET_STOREFRONT_PRODUCTS_SKUS` from
  `src/api/routes/storefront/products/skus.ts`.
- Testing manifest regenerated with `666` entries.
- HTTP contract matrix regenerated with `641` contracts.
- OpenAPI regenerated with `455` paths and `1058` schemas.
- Suite coverage check reported current; no suite coverage artifact changed.

## Commands Run

- `npm run build:src:tsgo` - initially failed before dependency install because
  the worktree lacked `node_modules` / `@types/node`.
- `npm ci` - passed; installed ignored worktree dependencies from lockfile.
- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed on the
  acceptance base with `619` missing, `561` implemented, and `1128` Discord
  routes.
- `npm run generate:testing-manifest` - passed with `666` entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` -
  reported stale contracts on the acceptance base.
- `npm run generate:contract-tests` - passed with `641` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed with existing route metadata warnings;
  generated `455` paths and `1058` schemas.
- `npm run build:test-fixtures` - passed.
- `npm run generate:contract-tests -- --check` - initially reported stale
  contracts.
- `npm run generate:contract-tests` - passed.
- `npm run generate:contract-tests -- --check` - passed.
- `npm run generate:suite-coverage -- --check` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/storefront-products-skus-route.test.js dist-test/test/routes/storefront-products-param-route.test.js dist-test/test/routes/storefront-products-sku-param-route.test.js` - passed, 15 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, 13 tests.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/generated/http-auth-runtime-contracts.test.js` - failed out of scope; see risks.
- `npm run build:test-fixtures` - passed after warranty header correction.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/storefront-products-skus-route.test.js` - passed, 6 tests.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json && git status --short -- package.json package-lock.json` - passed; no package or lockfile diffs.
- malformed warranty-token scan across `src`, `test`, `packages`,
  `assets`, `scripts`, `apps`, `docs`, `worker-progress`, and `dist-test` -
  passed with no matches after correcting the new test header.

## Risks And Blockers

- The default bulk route intentionally returns `{ products: [] }` until Spacebar
  has durable/configurable storefront product catalog data. It will not
  fabricate Discord catalog products for requested SKU IDs.
- The generated HTTP auth runtime contract failed outside this route:
  `api:http:GET:/discovery/search` returned `500` instead of `200` in
  `generated HTTP public response-schema contracts match real API responses`.
  This worker did not change discovery routes or schemas; `git diff` for
  discovery-related files is empty.
- Runtime contract startup also logged existing non-fatal registration errors
  for `guilds/:guild_id/analytics/*/query` files that export helpers rather
  than default routers.

## Prompt-To-Artifact Audit

- Confirmed the assigned missing entry and source absence before implementation.
- Reused adjacent accepted storefront auth, DTO cloning, generated metadata,
  and bearer-auth conventions.
- Added only a tiny shared helper,
  `storefrontProductIncludesSku`, to avoid duplicating SKU/product membership
  logic between the single-SKU and bulk-SKU routes.
- Added focused tests for auth boundary, query parsing, provider-backed
  products, empty local default, SKU/product mismatch filtering, clone safety,
  generated artifacts, and adjacent missing-route assertions.
- Regenerated schemas, source catalog, missing report, testing manifest, HTTP
  contracts, OpenAPI, and rebuilt test fixtures.

## Recommended Next Tasks

- Implement `/storefront/skus/prices` in its own assigned worker.
- Add durable/configurable storefront product catalog backing before returning
  non-empty default products for Discord storefront SKU IDs.
