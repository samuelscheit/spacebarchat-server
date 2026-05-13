# GET /users/@me/billing/churn-user-offer

## Summary

Implemented only the assigned `GET /users/@me/billing/churn-user-offer` route with authenticated route metadata, a documented response schema, and focused tests. The default implementation fails closed with `404 Unknown offer` because Spacebar does not currently persist Discord-managed retention discount offer state.

## Changed Files

- `src/api/routes/users/@me/billing/churn-user-offer.ts`
- `src/api/routes/users/@me/billing/churn-user-offer.test.ts`
- `src/schemas/responses/BillingChurnUserOfferResponse.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `testing/suite-coverage-policy.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained both:
    - `GET /users/@me/billing/churn-user-offer` as `GET_USERS__ME_BILLING_CHURN_USER_OFFER`
    - `POST /users/@me/billing/churn-user-offer` as `POST_USERS__ME_BILLING_CHURN_USER_OFFER`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no source route for the assigned path before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists the assigned `GET` route with summary `Get Churn User Offer`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `CHURN_USER_OFFER` for `GET`, plus sibling `HEAD`, `OPTIONS`, and `POST`.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/billing.mdx`
    - Documents `GET /users/@me/billing/churn-user-offer` as returning `{ offer: user discount offer object }`.
    - Documents `POST /users/@me/billing/churn-user-offer` as create behavior; this was intentionally not implemented.

## Implementation Notes

- Added `BillingChurnUserOfferResponse`, `BillingUserDiscountOfferResponse`, and `BillingUserDiscountResponse` to model the documented retention discount offer payload.
- Added an injectable provider boundary:
    - `getBillingChurnUserOffer(userId)` returns `null` until a real local billing provider/state model exists.
    - `createUserBillingChurnUserOfferRouter(provider)` supports tests and future provider integration.
- Route responses are declared as `200 BillingChurnUserOfferResponse`, `401 APIErrorResponse`, and `404 APIErrorResponse`.
- No gateway events, audit logs, writes, payment-provider calls, or sibling billing routes were added.

## Missing-Route Movement

- Before: `491` missing entries in `HEAD:packages/missing-routes/missing.json`.
- After regeneration: `490` missing entries.
- Removed from missing report:
    - `GET /users/@me/billing/churn-user-offer`
- Still missing and intentionally untouched:
    - `POST /users/@me/billing/churn-user-offer`

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/billing/churn-user-offer.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/routes/users/@me/billing/churn-user-offer.ts src/api/routes/users/@me/billing/churn-user-offer.test.ts src/schemas/responses/BillingChurnUserOfferResponse.ts src/schemas/responses/index.ts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json packages/*/package.json packages/*/package-lock.json`

## Verification Results

- `npm run build:src:tsgo`: passed.
- `npm run build:test-fixtures`: passed.
- Focused route test: passed, 5/5.
- Targeted ESLint: passed.
- `npm run test:manifest`: passed.
- `npm run test:suite-coverage`: passed.
- `npm run test:contracts`: failed only on known unrelated runtime failure:
    - `api:http:GET:/discovery/search` returned `500 !== 200`.
    - Runtime also logged pre-existing route-registration warnings for analytics `query` helper files without default routers.
- `git diff --check`: passed.
- Package/lockfile guard: passed; no package or lockfile diffs.

## Risks Or Blockers

- There is no durable local billing retention discount offer provider or subscription non-renewing-state model. The route therefore returns `404` by default rather than fabricating a discount object.
- A future billing-provider integration should replace `getBillingChurnUserOffer` with real user-scoped lookup behavior and preserve the current provider boundary.

## Recommended Next Tasks

- Implement the sibling `POST /users/@me/billing/churn-user-offer` separately when assigned.
- Add a durable local billing-offer provider/model before changing the default `404` behavior to `200`.

## Main-Branch Acceptance Reconciliation

- Replayed only source, focused test, schema export, suite/test config, and this report onto `ae34e62a4`.
- Regenerated schemas, OpenAPI, source route catalog, missing-route report, testing manifest, generated HTTP contracts, and suite coverage on the current base.
- Current-base missing-route movement: `490 -> 489`; implemented count `690 -> 691`; Discord count `1128`.
- Verification on the main checkout passed: `build:src:tsgo`, schema/OpenAPI/catalog/missing-route/manifest/contracts/suite regeneration, `build:test-fixtures`, focused built route test `5/5`, `test:manifest`, `test:suite-coverage`, generated contract check, generated suite coverage check, targeted ESLint, `git diff --check`, and package/lockfile guard.
- Full `npm run test:contracts` passed generated/static checks and failed only on the known unrelated runtime baseline: `api:http:GET:/discovery/search` returned `500 !== 200`.
