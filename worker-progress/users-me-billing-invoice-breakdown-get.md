# GET /users/@me/billing/invoice/breakdown

## Summary

Implemented the assigned authenticated `GET /users/@me/billing/invoice/breakdown` route only. The route validates the required `payment_id` query as a Discord snowflake and exposes the documented invoice-link response shape through `PaymentInvoiceBreakdownResponse`. Because Spacebar does not persist Discord billing payments or billing-provider invoice URLs, the default production behavior fails closed with `404 Unknown payment` instead of fabricating invoice data.

## Changed Files

- `src/api/routes/users/@me/billing/invoice/breakdown.ts`
- `src/api/routes/users/@me/billing/invoice/breakdown.test.ts`
- `src/schemas/responses/PaymentInvoiceBreakdownResponse.ts`
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
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/billing/invoice/breakdown.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
- `git diff --check`
- `git diff -- package.json package-lock.json npm-shrinkwrap.json && git status --short package.json package-lock.json npm-shrinkwrap.json`

## Verification Results

- Focused route test passed: 7 tests, 0 failures.
- `npm run build:src:tsgo` passed after installing dependencies in this worktree with `npm ci`.
- `npm run build:test-fixtures` passed.
- `npm run test:manifest` passed and verified 736 entries.
- `npm run test:suite-coverage` passed.
- `git diff --check` passed.
- Package/lockfile guard showed no package manifest or lockfile diff.
- `npm run test:contracts` failed only on the known unrelated runtime issue: `api:http:GET:/discovery/search` returned `500 !== 200` during generated public response-schema contracts.

## Missing-Route Movement

- Base missing entries: 550.
- Current missing entries: 549.
- Movement: -1.
- Base had assigned `GET /users/@me/billing/invoice/breakdown`: yes.
- Current missing report has assigned route: no.
- Source catalog now has `GET_USERS__ME_BILLING_INVOICE_BREAKDOWN` at `src/api/routes/users/@me/billing/invoice/breakdown.ts`.

## Evidence

- Missing report entry: `packages/missing-routes/missing.json` listed `GET_USERS__ME_BILLING_INVOICE_BREAKDOWN` from `userdoccers:resources/payment.mdx` and `xhyrom:data/client/routes.json`.
- Userdoccers payment docs: `https://docs.discord.food/resources/payment`, section "Get Payment Invoice Breakdown", documents `GET /users/@me/billing/invoice/breakdown`, required `payment_id` query, and optional `invoiceLink` / `refundInvoiceLinks` response fields.
- Local source catalog initially had no assigned GET route; regenerated source catalog now includes it.
- Nearby billing routes show only lightweight compatibility state for billing subscriptions/payment sources and no durable payment invoice model.

## Risks And Blockers

- Spacebar still has no durable payment table/model or billing-provider invoice URL integration for Discord payment records. Default behavior intentionally returns 404 for otherwise valid payment IDs.
- The route has a provider injection point for future real payment invoice resolution without changing route metadata.
- The broader contract suite remains blocked by the unrelated `GET /discovery/search` runtime 500.

## Adjacent Routes Untouched

- Did not implement or modify payment mutations, checkout, subscriptions preview/pay, Stripe/PayPal/Adyen flows, Nitro purchase, entitlements, or other billing routes.
- Existing payment-source and billing-subscriptions route behavior is unchanged.

## Reconciliation Notes

- Added the focused route test to `tsconfig.test.json` so it compiles into `dist-test`.
- Added the focused route test to the `users` suite policy and regenerated suite coverage.
- `npm ci` created local `node_modules` only; package manifests and lockfiles are unchanged.

## Completion Audit

- Objective deliverables checked: exact assigned GET route, assigned route name, locally truthful invoice behavior, focused tests, generated schemas/OpenAPI/catalog/missing report/testing artifacts, required verification gates, package/lockfile guard, and worker report.
- Current-state audit script verified the route file exists, only declares `router.get("/")`, validates required `payment_id`, fails closed without invoice fabrication, exposes `PaymentInvoiceBreakdownResponse`, removes the assigned missing-route entry, and has manifest/contract/suite coverage for `api:http:GET:/users/@me/billing/invoice/breakdown/`.
- Current-state focused test rerun passed: 7 tests, 0 failures.
- Current-state reruns passed: `npm run build:src:tsgo`, `npm run build:test-fixtures`, `npm run test:manifest`, `npm run test:suite-coverage`, and `git diff --check`.
- Current-state `npm run test:contracts` rerun still fails only on the known unrelated `api:http:GET:/discovery/search` runtime `500 !== 200`.
