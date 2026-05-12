# GET /users/@me/billing/localized-pricing-promo

## Summary

Implemented the assigned authenticated `GET /users/@me/billing/localized-pricing-promo` route only.

The route is intentionally conservative: it uses the existing `IpDataClient` country lookup pattern from nearby billing location routes, returns `{}` when no country is available, and returns `{ country_code, localized_pricing_promo: null }` when a country is detected. Spacebar does not currently persist Discord-managed localized pricing promotions, plan-specific promotional prices, or allowed payment-source promotion state, so no prices or offers are fabricated.

## Changed Files

- `src/api/routes/users/@me/billing/localized-pricing-promo.ts`
- `src/schemas/responses/BillingLocalizedPricingPromoResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/users-me-billing-localized-pricing-promo-get.test.ts`
- `test/scenarios/users-supplemental.test.ts`
- `scripts/testing-manifest/generate-contract-tests.js`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - Initial run failed because this worktree had no usable `node_modules/.bin/tsgo`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
  - Restored dependencies from the existing lockfile.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
  - Passed; generated `BillingLocalizedPricingPromo*Response` schemas.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
  - Passed; existing warning remains: 3 webhook routes missing route metadata.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
  - Passed; wrote `Spacebar is missing 549`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
  - Passed; manifest now has 736 entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
  - Passed; contract matrix now has 711 contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-billing-localized-pricing-promo-get.test.js`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
  - Failed only on known unrelated runtime failure: `api:http:GET:/discovery/search` returned `500 !== 200`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
  - Passed.
- `git diff --check`
  - Passed.
- `git diff -- package.json package-lock.json --exit-code`
  - Passed; package and lockfile unchanged.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-billing-localized-pricing-promo-get.test.js dist-test/test/scenarios/users-supplemental.test.js`
  - Focused route test passed; users supplemental scenario skipped because Postgres admin URL is unavailable.

## Evidence Gathered

- `packages/missing-routes/missing.json`
  - Before regeneration: one assigned missing entry for `GET /users/@me/billing/localized-pricing-promo` with route name `GET_USERS__ME_BILLING_LOCALIZED_PRICING_PROMO`.
  - After regeneration: assigned entry removed.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - Before implementation: no source route for the assigned path.
  - After implementation: source route present with `response_schema_refs: ["APIErrorResponse", "BillingLocalizedPricingPromoResponse"]`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
  - Userdoccers source: `userdoccers:resources/billing.mdx`, summary `Get Localized Pricing Promo`, assigned route name `GET_USERS__ME_BILLING_LOCALIZED_PRICING_PROMO`.
- Userdoccers billing documentation:
  - `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/billing.mdx`
  - Documents response fields `country_code` and nullable `localized_pricing_promo`; promo object includes `plan_id`, `country_code`, `payment_source_types`, and `price`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  - xHyroM source has `GET /users/@me/billing/localized-pricing-promo` with route name `BILLING_LOCALIZED_PROMO`, plus HEAD/OPTIONS.
- Nearby local routes:
  - `src/api/routes/users/@me/billing/country-code.ts`
  - `src/api/routes/users/@me/billing/location-info.ts`
  - `src/api/routes/users/@me/billing/payment-sources.ts`
  - `src/api/routes/users/@me/billing/subscriptions.ts`

## Missing-Route Movement

- Before: `Spacebar is missing 550`, `Spacebar implements 630`.
- After: `Spacebar is missing 549`, `Spacebar implements 631`.
- Assigned missing method found: `GET`.
- Methods implemented: `GET`.

## Adjacent Routes Untouched

Did not implement or modify campaign context, checkout recovery, churn/user offer, user trial offer, subscription preview, payment, purchase, Nitro affinity, or unrelated billing routes.

## Risks And Blockers

- Spacebar has no durable localized-pricing-promo provider or billing promotion model. The implemented response therefore reports no promo (`null`) rather than inventing plan IDs, currencies, amounts, or payment source eligibility.
- `npm run test:contracts` remains blocked by the known unrelated generated runtime failure for `api:http:GET:/discovery/search` returning `500 !== 200`.

## Recommended Next Tasks

- Add a real provider/model for locally configured billing promotions before returning non-null `localized_pricing_promo`.
- Separately investigate the existing `GET /discovery/search` runtime contract failure.
