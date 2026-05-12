# GET /users/@me/outbound-promotions/codes

## Summary

Accepted from worker `users_me_outbound_promotions_codes_get` and reconciled
onto current main commit `fc5d1aded`.

Implemented only `GET /users/@me/outbound-promotions/codes`. The route is
bearer-authenticated, declares the optional source-observed `locale` query, and
returns a fresh empty claimed promotion list because Spacebar has no configured
promotion-code provider or local current-user promotion-code store.

## Changed Files

- `src/api/routes/users/@me/outbound-promotions/codes.ts`
- `src/schemas/responses/PromotionResponse.ts`
- `test/routes/users-me-outbound-promotions-codes-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence

- Userdoccers `resources/promotion.mdx` documents "Get Claimed Promotions" for
  `GET /users/@me/outbound-promotions/codes` with an optional `locale` query
  and a claimed promotion list response.
- The xHyroM catalog includes the same path; only `GET` is in missing-route
  scope.
- Nearby local promotion routes return locally truthful empty arrays when no
  promotion provider is configured.
- Adjacent outbound promotion claim, listing, BOGO, billing, store purchase,
  and subscription routes remain untouched.

## Current-Base Movement

- Before: `missing = 595`, `spacebar = 585`, `discord = 1128`.
- After regeneration: `missing = 594`, `spacebar = 586`, `discord = 1128`.
- The assigned route is absent from `missing_entries[]`.

## Verification

Commands run with `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

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
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-outbound-promotions-codes-route.test.js dist-test/test/routes/promotionsRoute.test.js dist-test/test/routes/bogoPromotionsRoute.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:suite-coverage`
- `npm run lint`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json bun.lock`
- `npm run test:contracts`

Passing evidence:

- Focused outbound, promotion, and BOGO route tests passed: 13/13.
- OpenAPI regenerated with 477 paths and 1110 schemas.
- Testing manifest regenerated and verified with 691 entries.
- Generated HTTP contract tests regenerated and verified with 666 contracts.
- Generated contract/suite tests passed: 13/13.
- Suite coverage tests passed: 4/4.
- Lint, whitespace diff check, and package/lockfile guard passed.

Known unrelated failure:

- `npm run test:contracts` failed only on
  `api:http:GET:/discovery/search`, which returned runtime `500 !== 200`.
  The analytics `query.ts` route-registration warnings are existing baseline
  noise and unrelated to this route.
