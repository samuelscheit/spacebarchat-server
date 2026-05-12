# store-directory-param-get

## Summary

Accepted and integrated `GET /store/directory/{param}` as
`GET /store/directory/:param/` on current base `2e458d3f8`.

The route is bearer-authenticated and provider-backed. The default provider
returns `undefined`, so Spacebar fails closed with Discord's unknown store
directory layout error instead of fabricating curated store directory, ranking,
SKU, billing, entitlement, Nitro, subscription, or merchandising state.

## Changed Files

- `src/api/routes/store/directory/#param.ts`
- `src/schemas/responses/StoreDirectoryResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/store-directory-param-route.test.ts`
- `assets/openapi.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/store-directory-param-get.md`

## Evidence

- `packages/missing-routes/missing.json` contained `GET
  /store/directory/{param}` with route name `STORE_DIRECTORY`.
- The xHyroM route catalog lists the same route shape and route name.
- Nearby local store routes expose persisted listing, SKU, storefront, and price
  tier data, but there is no local model for Discord's curated store directory.
- The completed worker handoff in
  `/Users/user/Developer/Developer/spacebarchat/worktrees/current-store-directory-param-get-agent/worker-progress/store-directory-param-get.md`
  reported the same behavior on worker base `fef56617c`.

## Behavior

- `401` for missing bearer auth through standard authentication middleware.
- `200` with the configured provider result when an embedding later supplies a
  local `StoreDirectoryResponse`.
- `404` with Discord error code `10033` for malformed snowflake-like route IDs
  or when no local directory is configured.
- `400` with field error code `50035` for malformed `localize` query booleans.
- Accepts `country_code` string query values and defaults `localize` to `true`.

## Missing-Route Movement

- Current base: `2e458d3f8`
- Missing count: `552 -> 551`
- Spacebar implemented count: `628 -> 629`
- Discord implemented count: `1128`
- Removed from missing: `GET /store/directory/{param}`
- Adjacent `GET /store/directory-layouts/{param}` remains missing.

## Verification

- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test test/routes/store-directory-param-route.test.ts`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/store-directory-param-route.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx eslint 'src/api/routes/store/directory/#param.ts' src/schemas/responses/StoreDirectoryResponse.ts test/routes/store-directory-param-route.test.ts`
- `npx prettier --check 'src/api/routes/store/directory/#param.ts' src/schemas/responses/StoreDirectoryResponse.ts test/routes/store-directory-param-route.test.ts`
- `git diff --check`
- Package and lockfile guard over changed files
- License-header typo scan over touched source and test files

## Verification Notes

- Focused source route test passed: `5/5`.
- Focused built route test passed: `5/5`.
- Testing manifest verification passed: `734` entries.
- Generated HTTP contract static checks passed: `709` contracts and `10/10`
  matrix tests.
- Generated suite coverage checks passed: `4/4` tests.
- OpenAPI regeneration produced `518` paths and `1172` schemas.
- Package and lockfile guard passed; no package or lockfile changed.
- `npm run test:contracts` failed only on the known unrelated runtime contract:
  `api:http:GET:/discovery/search` returned `500` instead of `200`. Existing
  analytics `query.ts` route-registration noise remains unrelated.

## Risks And Boundaries

- `StoreDirectoryResponse` is currently `unknown` because no stable local schema
  exists for Discord's private curated store directory payload.
- The default provider intentionally returns no directory until Spacebar has
  durable local directory backing.
- No `/store/directory-layouts/{param}`, SKU purchase, billing, subscription,
  Nitro, entitlement, storefront mutation, payment, or unrelated store route was
  implemented.
