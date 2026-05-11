# storefront_products_param_get

## Summary

- Implemented `GET /storefront/products/{product_id}` as `src/api/routes/storefront/products/#product_id.ts`.
- Added a typed `StorefrontProductResponse` DTO and exported it through `@spacebar/schemas`.
- Repaired the audit blocker where the response omitted the source-documented required `skus` field. The DTO now includes typed nested storefront product SKU structures, the route deep-clones `skus`, and the focused test/schema assertions cover the field.
- During orchestrator port, widened Product SKU `thumbnail_asset_id` to `Snowflake | null` because the source example serializes it as `null`.
- Behavior is bearer-authenticated and fail-closed: Spacebar has no durable storefront product catalog, so the default provider returns no product and the route returns `Unknown Product` (`10987`, 404) rather than fabricated Discord storefront data.
- Added focused route tests covering auth mode, provider-backed serialization, fail-closed unknown handling, generated metadata, and adjacent route non-ownership.
- The worker reconciled to `1b5b7ecf3`; the orchestrator ported scoped source, schema, test, and report changes onto current base `92b3fc28e` and regenerated artifacts there so accepted quest route artifacts are preserved.

## Assigned Path

- Assigned missing entry: `GET_STOREFRONT_PRODUCTS_PRODUCT_ID`
- Assigned path: `/storefront/products/{param}`
- Source route: `/storefront/products/{product_id}`
- Source: `userdoccers:resources/store.mdx`
- Userdoccers reference used: `https://docs.discord.food/resources/store`, especially Storefront Product object and `Get Storefront Product`.

## Evidence

- `packages/missing-routes/missing.json` had the assigned entry before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `/storefront/products/{product_id}` source entry before implementation.
- No `src/api/routes/storefront` implementation existed before this worker.
- Userdoccers documents the response as a single storefront product object and does not document query parameters for `GET /storefront/products/{product.id}`.
- Userdoccers documents `skus` as a required array on the Storefront Product object.
- Userdoccers does not mark this endpoint as unauthenticated; local store/collectibles/partner storefront routes default to bearer auth unless explicitly listed in `NO_AUTHORIZATION_ROUTES`.

## Changed Files

- `src/api/routes/storefront/products/#product_id.ts`
- `src/schemas/responses/StorefrontProductResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/storefront-products-param-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Missing Count Movement

- Worker base missing count from `HEAD:packages/missing-routes/missing.json`: `628`
- Initial post-route missing count after worker regeneration: `627`
- Worker current-base regenerated missing count after merge with `1b5b7ecf3`: `624`
- Orchestrator current-base regenerated missing count after port onto `92b3fc28e`: `624 -> 623`; implemented `556 -> 557`
- Removed assigned missing entry: yes
- Adjacent `/storefront/products/sku/{param}` remains missing: yes
- Adjacent `/storefront/products/skus` remains missing: yes

## Commands Run

Worker commands:

- `HUSKY=0 npm ci --no-audit --no-fund`
- `npm run build:src:tsgo`
- `npm run generate:schema`
- `git merge --no-ff 1b5b7ecf3 -m "Merge current integration base for storefront product route"` (generated artifact conflicts resolved by regeneration)
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `npm run generate:openapi`
- `node scripts/testing-manifest/generate-contract-tests.js --check` (reported stale contracts)
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/storefront-products-param-route.test.js`
- `node --test test/generated/http-contracts.test.js`
- `node --test test/generated/suite-coverage.test.js`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/generated/http-auth-runtime-contracts.test.js` (failed out of scope; see risks)
- `git diff --check`
- `git diff --name-only -- package.json package-lock.json apps package-lock.json packages/*/package.json`
- malformed warranty-token scan across changed source, test, generated, and
  report files

Orchestrator current-base commands:

- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` (reported stale contracts before regeneration)
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/storefront-products-param-route.test.js`
- `node --test test/generated/http-contracts.test.js`
- `node --test test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npm run test:contracts` (failed only in known unrelated runtime case; see risks)
- `npm run lint`
- `git diff --check`
- `git diff --name-only -- package.json package-lock.json apps package-lock.json packages/*/package.json`
- malformed warranty-token scan across changed files

## Verification Results

- Source build: pass in worker.
- Schema generation: pass in worker.
- Automatic reverse-engineering build/import: pass in worker.
- Missing-routes build/start: pass in worker; count moved `628 -> 627` for this route, then `627 -> 624` after merging current base and regenerating accepted route artifacts.
- Testing manifest generation and verify: pass in worker.
- OpenAPI generation: pass in worker; unrelated existing warnings for routes without `route()` metadata remain.
- Contract check/regeneration/check: pass in worker after regenerating `test/generated/http-contracts.json`.
- Suite coverage check: pass in worker; no suite coverage regeneration needed.
- Test fixtures build: pass in worker.
- Focused route tests: pass in worker, 5/5.
- Generated HTTP contract matrix: pass in worker, 9/9.
- Generated suite coverage matrix: pass in worker, 4/4.
- `git diff --check`: pass in worker.
- Package/lockfile guard: pass in worker; no `package.json` or `package-lock.json` diffs.
- Malformed warranty-token scan: pass in worker.

- Current-base verification passed source build, schema generation, automatic reverse-engineering build/import, missing-routes build/start (`624 -> 623`, implemented `556 -> 557`), testing manifest generation/verify with 662 entries, contract regeneration/check with 637 contracts, suite coverage check, OpenAPI generation with 451 paths and 1055 schemas, test fixture build, focused route tests 5/5, generated contract tests 9/9, generated suite coverage tests 4/4, manifest tests 30/30, suite coverage test, lint, diff check, package/lockfile guard, and changed-file malformed warranty-token scan.
- Current-base `npm run test:contracts` passed static/generated contract checks and failed only in the known unrelated runtime public response-schema case for `api:http:GET:/discovery/search` returning `500` instead of `200`.

## Risks / Blockers

- Spacebar still lacks a durable storefront product catalog, so production default behavior is fail-closed 404 for all product IDs until a local product source exists.
- Full generated auth-runtime contracts failed outside this route in the worker worktree: `api:http:GET:/discovery/search` returned 500 in `generated HTTP public response-schema contracts match real API responses`; this worker did not touch discovery/search.
- Runtime route registration also logged existing non-fatal failures for `guilds/:guild_id/analytics/*/query` files without default routers while running the generated auth-runtime suite.

## Next Tasks

- Implement adjacent `/storefront/products/sku/{param}` and `/storefront/products/skus` in separate assigned workers.
- Add durable/configurable storefront product catalog storage before changing this route from fail-closed default behavior.
