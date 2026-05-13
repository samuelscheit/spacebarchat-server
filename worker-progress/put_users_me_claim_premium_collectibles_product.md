# PUT /users/@me/claim-premium-collectibles-product

## Summary

Implemented the assigned method-scoped route `PUT /users/@me/claim-premium-collectibles-product` as an authenticated compatibility endpoint.

The route validates the documented JSON body `{ "sku_id": "<snowflake>" }`, declares the documented `200` purchases response and `204` already-claimed response, and defaults to a `501` fail-closed provider path because Spacebar does not currently persist collectible ownership, premium entitlement eligibility, or a claim transaction store. Instances can wire a real provider through `createPremiumCollectiblesProductClaimRouter`.

## Changed Files

- `src/api/routes/users/@me/claim-premium-collectibles-product.ts`
- `src/api/routes/users/@me/claim-premium-collectibles-product.test.ts`
- `src/schemas/uncategorised/CollectiblesPremiumProductClaimSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `src/schemas/responses/CollectiblesCategoriesResponse.ts`
- `tsconfig.test.json`
- `testing/suite-coverage-policy.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/put_users_me_claim_premium_collectibles_product.md`

## Missing-Route Movement

- Worker branch movement before integration: `packages/missing-routes/missing.json` had 487 missing entries and contained:
    - `PUT /users/@me/claim-premium-collectibles-product`
    - `PUT_USERS__ME_CLAIM_PREMIUM_COLLECTIBLES_PRODUCT`
- Worker branch regeneration moved missing count to 486.
- Current-base integration movement: `missing_entries.length = 484 -> 483`, `routes.length = 394 -> 393`, `spacebar = 696 -> 697`, `discord = 1128`.
- Current generated artifacts: OpenAPI `564` paths / `1225` schemas, testing manifest `802` entries, generated HTTP contracts `777`.
- The assigned route is now present in `routes.source.catalog.json` with:
    - method `PUT`
    - route `/users/@me/claim-premium-collectibles-product`
    - route name `PUT_USERS__ME_CLAIM_PREMIUM_COLLECTIBLES_PRODUCT`
    - request schema `CollectiblesPremiumProductClaimSchema`
    - response schemas `APIErrorResponse`, `CollectiblesPurchasesResponse`
- The assigned route no longer appears in `missing_entries[]` or `routes[]`.

## Evidence

- `packages/missing-routes/missing.json` listed the assigned route before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no source entry before implementation and now has the new `PUT` entry.
- Userdoccers source: `resources/collectibles.mdx` documents "Claim Premium Collectibles Product", JSON param `sku_id`, `200` owned collectible products, and `204` if already claimed.
    - URL used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/collectibles.mdx`
- xHyroM source catalog lists `COLLECTIBLES_CLAIM` for both `OPTIONS` and `PUT` on `/users/@me/claim-premium-collectibles-product`.

## Commands Run

- `npm ci`
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
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/claim-premium-collectibles-product.test.js dist-test/src/schemas/responses/CollectiblesCategoriesResponse.test.js`
- `npx eslint src/api/routes/users/@me/claim-premium-collectibles-product.ts src/api/routes/users/@me/claim-premium-collectibles-product.test.ts src/schemas/responses/CollectiblesCategoriesResponse.ts src/schemas/uncategorised/CollectiblesPremiumProductClaimSchema.ts src/schemas/uncategorised/index.ts`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run test:contracts`
- `npx prettier --check src/api/routes/users/@me/claim-premium-collectibles-product.ts src/api/routes/users/@me/claim-premium-collectibles-product.test.ts src/schemas/responses/CollectiblesCategoriesResponse.ts src/schemas/uncategorised/CollectiblesPremiumProductClaimSchema.ts src/schemas/uncategorised/index.ts testing/suite-coverage-policy.json tsconfig.test.json worker-progress/put_users_me_claim_premium_collectibles_product.md`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json npm-shrinkwrap.json 'packages/*/package.json' 'packages/*/package-lock.json'`

## Verification Results

- Focused route/schema tests: passed, 13 tests.
- Targeted ESLint: passed with expected ignore warnings for JSON/tsconfig files during current-base replay.
- `npm run test:manifest`: passed, 802 entries verified.
- `npm run test:suite-coverage`: passed.
- Generated contract check and suite coverage check: passed.
- `npm run build:src:tsgo`: passed as a standalone command after implementation.
- `npm run build:test-fixtures`: passed.
- Prettier check: passed after formatting the replayed route and progress report.
- `git diff --check`: passed.
- Package/lockfile guard: passed, no `package.json` or `package-lock.json` diff.
- `npm run test:contracts`: generated/static contract checks passed, runtime failed only on the known unrelated `api:http:GET:/discovery/search` public response-schema assertion (`500 !== 200`).

## Sibling Routes Intentionally Untouched

- Did not implement xHyroM `OPTIONS /users/@me/claim-premium-collectibles-product`; assignment was method-scoped to `PUT`.
- Did not implement adjacent collectibles claim/reward, clan, marketing, purchases, or gift-recipient routes.
- Existing `GET /users/@me/collectibles-purchases` handler behavior was not changed; only the shared `CollectiblesPurchasesResponse` schema type was added so the new route and existing catalog reference have a concrete schema.

## Risks / Blockers

- Durable local claim behavior is blocked on a real collectibles ownership store, premium entitlement eligibility source, and idempotent claim transaction persistence. The default route therefore fails closed with `501` after schema validation.
- No gateway or audit-log event is emitted because no local claim mutation occurs in the default provider.

## Recommended Next Tasks

- Add a durable collectibles ownership/provider abstraction if Spacebar intends to support real premium collectible claims.
- Once ownership and premium entitlement state exist, wire the provider to return `CollectiblesPurchasesResponse` on first claim and `null` for already-claimed `204`.
