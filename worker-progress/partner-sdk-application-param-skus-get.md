# partner-sdk-application-param-skus-get

## Summary

Accepted and integrated `GET /partner-sdk/application/{param}/skus` as
`GET /partner-sdk/application/:application_id/skus/` on current base
`8d3c43eff`.

The route is bearer-authenticated, validates the application ID, requires local
application store access through the existing application authorization helper,
and returns locally backed Social Layer game item SKUs only. Spacebar has no
durable Discord Social Layer SKU catalog, so the default provider returns an
empty array. Provider-backed responses are sanitized through
`toStoreSkuResponse`, filtered to the requested application, and limited to
product line `14` (`SOCIAL_LAYER_GAME_ITEM`).

## Changed Files

- `src/api/routes/partner-sdk/application/#application_id/skus.ts`
- `src/schemas/responses/PartnerSdkApplicationSkusResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/partner-sdk-application-param-skus-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/partner-sdk-application-param-skus-get.md`

## Evidence

- Userdoccers `resources/store.mdx` lists
  `GET /partner-sdk/application/{application_id}/skus` as
  `Get Social Layer SKUs`.
- The local xHyroM catalog has no matching route evidence for this path.
- Existing local behavior patterns used:
  `src/api/routes/partner-sdk/applications/#application_id/skus/recommendations.ts`,
  `src/api/routes/store/skus/#sku_id.ts`,
  `src/api/util/utility/StoreSkuRoute.ts`, and
  `src/api/util/utility/ApplicationAuthorization.ts`.
- Only the assigned `GET` route was implemented. `POST
/partner-sdk/application/{param}/skus` remains missing.

## Missing-Route Movement

- Current base: `8d3c43eff`
- Missing count: `558 -> 557`
- Spacebar implemented count: `622 -> 623`
- Discord implemented count: `1128`
- Removed from missing:
  `GET /partner-sdk/application/{param}/skus`
- Still intentionally missing:
  `POST /partner-sdk/application/{param}/skus`

## Verification

- `npm run build:tsgo`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/partner-sdk-application-param-skus-route.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx eslint src/api/routes/partner-sdk/application/#application_id/skus.ts src/schemas/responses/PartnerSdkApplicationSkusResponse.ts test/routes/partner-sdk-application-param-skus-route.test.ts`
- `npx prettier --check src/api/routes/partner-sdk/application/#application_id/skus.ts src/schemas/responses/PartnerSdkApplicationSkusResponse.ts test/routes/partner-sdk-application-param-skus-route.test.ts src/schemas/responses/index.ts`
- `git diff --check`
- `git diff -- package.json package-lock.json`
- `git status --short package.json package-lock.json`

## Verification Notes

- Focused route test passed: `5/5`.
- OpenAPI regeneration produced `513` paths and `1164` schemas.
- Testing manifest verification passed: `728` entries.
- Generated HTTP contract static checks passed: `703` contracts and `10/10`
  matrix tests.
- Generated suite coverage checks passed: `4/4` tests.
- Package and lockfile guard passed; `package.json` and `package-lock.json`
  are unchanged.
- `npm run test:contracts` failed only on the known unrelated runtime contract:
  `api:http:GET:/discovery/search` returned `500` instead of `200`. Existing
  analytics `query.ts` route-registration noise remains unrelated.

## Risks And Boundaries

- Spacebar does not persist Discord Social Layer SKU catalog state, storefront
  placement, pricing, subscriptions, entitlements, billing, Nitro, or purchase
  state. The route therefore defaults to an empty array rather than fabricated
  SKU data.
- Provider-backed data is filtered to the requested application ID and Social
  Layer game item product line before serialization.
- No SKU mutation, storefront, guild storefront, store purchase, billing, or
  Nitro route was implemented.
