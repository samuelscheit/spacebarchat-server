# GET /users/@me/billing/adyen/payment-methods

## Summary

Implemented `GET /users/@me/billing/adyen/payment-methods` as an authenticated fail-closed compatibility route. Userdoccers documents this endpoint as an Adyen Checkout `paymentMethods` proxy; this repo has no Adyen merchant integration, processor configuration, or local payment-method discovery state, so the route returns an explicit `501` `APIErrorResponse` instead of fabricating Adyen availability.

## Changed Files

- `src/api/routes/users/@me/billing/adyen/payment-methods.ts`
- `test/routes/users-me-billing-adyen-payment-methods-get.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/users-me-billing-adyen-payment-methods-get.md`

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` (first attempt before `npm ci` failed because `tsgo` was not installed; rerun passed)
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-billing-adyen-payment-methods-get.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` (failed only on known unrelated `api:http:GET:/discovery/search` runtime `500 !== 200`)
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` contained the assigned missing entry with route name `GET_USERS__ME_BILLING_ADYEN_PAYMENT_METHODS`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/users/@me/billing/**` had no source route for `/users/@me/billing/adyen/payment-methods` before this change.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` maps the route to `userdoccers:resources/billing.mdx`, summary `Get Available Adyen Payment Methods`.
- Userdoccers `pages/resources/billing.mdx` documents the endpoint as returning available methods for the `ADYEN` payment gateway and as a proxy to Adyen Checkout `paymentMethods`: https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/billing.mdx
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `GET`, `HEAD`, and `OPTIONS` for `/users/@me/billing/adyen/payment-methods` with route name `BILLING_ADYEN_PAYMENT_METHODS`.
- Existing fail-closed patterns used for unsupported third-party/provider-backed features: `src/api/routes/age-verification/verify.ts`, `src/api/routes/consoles/xbox-handoff.ts`, and `src/api/routes/invites/index.ts`.

## Missing-Route Movement

- Before regeneration on this base: `missing: 550`, `spacebar: 630`, `discord: 1128`.
- After regeneration: `missing: 549`, `spacebar: 631`, `discord: 1128`.
- The assigned `GET /users/@me/billing/adyen/payment-methods` entry was removed from `missing_entries`.

## Behavior Implemented

- Added only `GET /users/@me/billing/adyen/payment-methods/`.
- Route is bearer-authenticated via normal route boundary behavior.
- Route metadata declares `401` and `501` `APIErrorResponse`; it does not declare or fabricate a `200` Adyen response.
- Runtime behavior throws `ApiError(ADYEN_PAYMENT_METHODS_UNSUPPORTED_MESSAGE, 0, 501)` after auth.

## Adjacent Routes Untouched

No payment-source mutation, payments, subscriptions, checkout recovery, Stripe payment intents/setup intents, Nitro purchase, premium, entitlement, invoice, or unrelated billing routes were implemented or changed.

## Risks And Blockers

- A real `200` Adyen response requires an Adyen merchant integration and payment-method discovery inputs/state that Spacebar does not currently expose in this codebase.
- Clients attempting a Discord Adyen checkout flow will receive `501` until that provider integration exists. This is intentional fail-closed behavior to avoid false payment availability.
- `npm run test:contracts` still fails on the known unrelated `api:http:GET:/discovery/search` runtime schema check returning `500 !== 200`; generated contract checks before runtime passed.

## Reconciliation Notes

- `npm ci` installed local `node_modules` because the assigned worktree had no dependencies and `tsgo` was missing.
- Package and lockfile guard passed with no `package.json` or `package-lock.json` changes.
- `git diff --check` passed.
