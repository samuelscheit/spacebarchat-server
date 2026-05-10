# Collectibles Products Param GET

## Summary

Implemented the assigned authenticated `GET /collectibles-products/{param}` route as `GET /collectibles-products/{sku_id}` in the Spacebar route tree. The route exposes source-backed response metadata, query metadata, a typed `CollectiblesProductResponse`, deterministic SKU lookup helpers, and conservative `404 Unknown SKU` behavior because Spacebar currently has no persisted collectible product catalog to serve real purchasable data.

## Assigned Path

- Assigned path: `/collectibles-products/{param}`
- Missing methods found: `GET /collectibles-products/{param}` (`GET_COLLECTIBLES_PRODUCTS_SKU_ID`)
- Source route: `/collectibles-products/{sku_id}`
- Methods implemented: `GET`

## Changed Files

- `src/api/routes/collectibles-products/#sku_id/index.ts`
- `src/schemas/responses/CollectiblesCategoriesResponse.ts`
- `test/routes/collectibles-products-route.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `worker-progress/collectibles-products-param-get.md`

## What Changed

- Added a new route module mounted at `/collectibles-products/:sku_id/`.
- Kept the route behind bearer authentication by default; it is not in `NO_AUTHORIZATION_ROUTES`.
- Added response metadata for `200 CollectiblesProductResponse`, `401 APIErrorResponse`, and `404 APIErrorResponse`.
- Added query metadata for `country_code`, `include_bundles`, and `variants_return_style`.
- Added `CollectiblesProductResponse` as a union of existing collectible product and variant schema types.
- Added product/variant lookup helpers over a collectible category catalog.
- Returned `404` with Discord-compatible `Unknown SKU` code `10027` when no product backing exists or no SKU matches.
- Avoided fabricated product details; the default catalog is intentionally empty until Spacebar has exact collectible product backing.

## Missing-Route Movement

- Before regeneration: `missing = 831`, `spacebar = 349`.
- After regeneration: `missing = 830`, `spacebar = 350`.
- The `/collectibles-products/{param}` route was removed from `packages/missing-routes/missing.json`.
- `routes.source.catalog.json` now contains `GET /collectibles-products/{sku_id}` from `src/api/routes/collectibles-products/#sku_id/index.ts`.

## Evidence Gathered

- `packages/missing-routes/missing.json` had the assigned missing entry at the start: `GET_COLLECTIBLES_PRODUCTS_SKU_ID`, source route `/collectibles-products/{sku_id}`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` did not contain `collectibles-products` before implementation.
- Local Userdoccers catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `GET /collectibles-products/{sku_id}`, route name `GET_COLLECTIBLES_PRODUCTS_SKU_ID`, source `userdoccers:resources/collectibles.mdx`.
- Local xHyroM catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `GET`, `HEAD`, and `OPTIONS` for `/collectibles-products/{param}` as `COLLECTIBLES_PRODUCTS`; only `GET` was assigned.
- Upstream Userdoccers source used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/collectibles.mdx`. It documents `Get Collectibles Product` as returning a collectible product for a SKU ID and lists `country_code`, `include_bundles`, and `variants_return_style` query params.
- Nearby Spacebar patterns used:
  - `src/api/routes/collectibles-categories.ts` and `src/api/routes/collectibles-shop.ts` return empty compatibility catalog/shop bodies rather than fabricated data.
  - `src/api/routes/users/@me/collectibles-marketing.ts` includes authenticated-route `401`/`404` metadata.
  - `src/api/routes/store/published-listings/skus/#sku_id/subscription-plans.ts` uses `404` for unknown SKU-backed store data.
  - `test/scenarios/store-published-listings.test.ts` explicitly asserts no fabricated store data for unsupported store listings.

## Commands Run

- `npm ci` after confirming `node_modules` was missing.
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/collectibles-products-route.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` initially reported stale generated contracts.
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `git diff --check`
- Changed-file malformed warranty-token scan over changed scoped files.

## Verification Result

- Source build passed.
- Test fixture build passed.
- Focused compiled route test passed: 3 tests, 3 pass.
- Automatic reverse-engineering build passed.
- Missing-routes build and regeneration passed.
- Schema generation passed and produced `CollectiblesProductResponse`.
- Testing manifest verified with 455 entries.
- Generated HTTP contract tests verified with 430 contracts.
- Generated suite coverage verified.
- OpenAPI generation passed and includes `/collectibles-products/{sku_id}/`.
- `git diff --check` passed.
- Warranty malformed-token scan returned no matches in changed scoped files.

## Risks / Blockers

- Spacebar still has no exact collectible product persistence/config backing. The production default therefore returns `404 Unknown SKU` for every SKU instead of inventing purchasable product details.
- Live Discord-specific error body details for this private user route were not available beyond Userdoccers/xHyroM catalog evidence; the implementation uses the existing Discord unknown SKU code with explicit `404`.

## Recommended Next Tasks

- Add a real configurable or persisted collectible product catalog, then wire `getCollectiblesProductCatalog()` to it.
- Add source-backed support for bundle product traversal once Spacebar has bundle backing.
- Implement adjacent collectibles routes only through their own assignments.

## Goal Status Evidence

- `create_goal` objective: `implement the missing route path GET /collectibles-products/{param} for the Spacebar server API`
- `get_goal` after setup: status `active`, same objective.
- `get_goal` after verification: status `active`, same objective, tokens used `276786`, time used `495s`.
- Final pane evidence: worker reported goal status `complete`; final goal usage was `289097` tokens and `594` seconds.
