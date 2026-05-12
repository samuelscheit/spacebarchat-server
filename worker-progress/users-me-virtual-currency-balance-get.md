# GET /users/@me/virtual-currency/balance

## Summary

Implemented the assigned `GET /users/@me/virtual-currency/balance` route only. The route is bearer-authenticated and returns the narrow locally truthful Orbs balance representation:

```json
{ "balance": 0 }
```

Spacebar has no durable local Orbs ledger in this worktree, so the implementation does not fabricate Discord virtual-currency, SKU, purchase, payment, subscription, Nitro, entitlement, or redeem state.

## Changed Files

- `src/api/routes/users/@me/virtual-currency/balance.ts`
- `src/schemas/responses/VirtualCurrencyBalanceResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/users-me-virtual-currency-balance-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained:
  - method: `GET`
  - route: `/users/@me/virtual-currency/balance`
  - route name: `GET_USERS__ME_VIRTUAL_CURRENCY_BALANCE`
  - sources: `userdoccers:resources/store.mdx`, `xhyrom:data/client/routes.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no matching local source entry before implementation.
- Userdoccers catalog entry:
  - `GET /users/@me/virtual-currency/balance`
  - summary: `Get Virtual Currency Balance`
  - source: `resources/store.mdx`
- Userdoccers docs page source: https://docs.discord.food/resources/store
  - documents the endpoint as returning the current user's Orbs balance with response field `balance`.
- xHyroM catalog entries:
  - `GET /users/@me/virtual-currency/balance`
  - `HEAD /users/@me/virtual-currency/balance`
  - `OPTIONS /users/@me/virtual-currency/balance`
  - route name: `VIRTUAL_CURRENCY_USER_BALANCE`
- Nearby local no-provider commerce/current-user patterns studied:
  - `src/api/routes/users/@me/outbound-promotions/codes.ts` returns a fresh empty claimed promotion list.
  - `src/api/routes/users/@me/entitlements.ts` returns a fresh empty current-user entitlement list.
  - `src/api/routes/users/@me/consumable/confetti.ts` and `src/api/util/utility/ConfettiConsumable.ts` return `entitlement: null` and `num_potions: 0` while failing closed for mutation.
  - `src/api/routes/users/@me/consumable/hd-streaming.ts` and `src/api/util/utility/HDStreamingConsumable.ts` return `entitlement: null` while failing closed for mutation.
  - `src/api/routes/store/consumable/pricing/#sku_id.ts` fails closed when no local pricing provider exists.

## Route Movement

- Assigned path: `/users/@me/virtual-currency/balance`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Regenerated missing-route movement:
  - `missing`: `594 -> 593`
  - `spacebar`: `586 -> 587`
  - `discord`: `1128` unchanged
- The assigned missing entry was removed from `packages/missing-routes/missing.json`.
- New source catalog entry:
  - method: `GET`
  - route: `/users/@me/virtual-currency/balance`
  - route name: `GET_USERS__ME_VIRTUAL_CURRENCY_BALANCE`
  - source: `src/api/routes/users/@me/virtual-currency/balance.ts`
  - response schemas: `APIErrorResponse`, `VirtualCurrencyBalanceResponse`

## Behavior

- Requires bearer auth.
- Returns HTTP `200` with `{ "balance": 0 }` for authenticated current users.
- Returns HTTP `401` through existing auth middleware when no Authorization header is present.
- Uses `VirtualCurrencyBalanceResponse` with required integer `balance` and minimum `0`.
- Returns a fresh response object from the helper to avoid shared mutable default state.

## Adjacent Routes Intentionally Untouched

- Virtual-currency redeem routes.
- Store SKU purchase and purchase preview routes.
- Storefront/SKU catalog routes.
- Billing, payment source, and payment routes.
- Subscription, premium/Nitro, entitlement, and promotion routes.
- Other current-user settings or inventory routes.

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
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-virtual-currency-balance-route.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json packages/*/package.json apps/*/package.json`
- `rg -n "MERMER|MERCHANTIBILITY|MERMERMERMERCHANTABILITY" src/api/routes/users/@me/virtual-currency/balance.ts src/schemas/responses/VirtualCurrencyBalanceResponse.ts test/routes/users-me-virtual-currency-balance-route.test.ts || true`

## Verification Results

- `npm run build:src:tsgo`: passed after installing dependencies in this worktree.
- `npm run build:test-fixtures`: passed.
- Focused route test: passed, 3 tests.
- `node scripts/testing-manifest/verify.js`: passed, 692 entries.
- `npm run test:suite-coverage`: passed.
- `npm run test:contracts`: generated/static contract checks passed, then failed in runtime on the known unrelated `api:http:GET:/discovery/search` public response-schema check with `500 !== 200`.
- `git diff --check`: passed.
- Package/lockfile guard: passed; no `package.json` or lockfile diffs.
- New-file license typo scan: passed.

## Completion Audit

- Exact route only: `find src/api/routes/users/@me/virtual-currency -type f` shows only `balance.ts`; no redeem, purchase, billing, subscription, SKU, Nitro, or settings route was added.
- Assigned missing entry: `jq` confirmed no `GET /users/@me/virtual-currency/balance` entry remains in `packages/missing-routes/missing.json`, and the aggregate count is `missing: 593`, `spacebar: 587`, `discord: 1128`.
- Source evidence: Userdoccers catalog still contains `GET_USERS__ME_VIRTUAL_CURRENCY_BALANCE`; xHyroM catalog contains `VIRTUAL_CURRENCY_USER_BALANCE` for `GET`, `HEAD`, and `OPTIONS`.
- Local source catalog: `routes.source.catalog.json` contains the new `GET` entry with `APIErrorResponse` and `VirtualCurrencyBalanceResponse`.
- Durable backing check: a source scan found no current-user Orbs ledger; existing Orbs references are SKU reward fields, checkpoint counters, shop eligibility filters, and this new route/schema.
- Local behavior: the route helper returns a fresh `{ balance: 0 }` object, matching no-provider local commerce patterns.
- Authentication boundary: focused route test asserts the route is not no-auth for `GET`/`HEAD`/`POST` and receives existing `401` behavior for missing auth.
- Generated schemas/OpenAPI: `assets/schemas.json` defines required integer `balance` with minimum `0`; `assets/openapi.json` exposes `200` `VirtualCurrencyBalanceResponse`, `401` `APIErrorResponse`, and bearer security.
- Generated manifest/contracts/suite coverage: `assets/testing-manifest.json`, `test/generated/http-contracts.json`, and `test/generated/suite-coverage.json` all contain `api:http:GET:/users/@me/virtual-currency/balance/`.
- Verification rerun: `build:src:tsgo`, `build:test-fixtures`, focused route test, manifest verify, suite coverage, `git diff --check`, and package/lockfile guard passed on the final tree.
- Contract runtime: `npm run test:contracts` rerun still fails only on the known unrelated `api:http:GET:/discovery/search` `500 !== 200` runtime check after generated/static contract checks pass.

## Risks Or Blockers

- No durable Orbs ledger exists locally, so this route intentionally exposes only the empty local balance. If Spacebar later adds a virtual-currency ledger, this helper should be wired to that store.
- Full runtime contract suite still has the known unrelated discovery search failure; this route's focused test and generated metadata checks passed.

## Reconciliation

- Worktree branch: `codex/current-missing-route-users-me-virtual-currency-balance-get-agent`
- Local base: `d5a784793 Implement current user outbound promotion codes route`
- No merge/rebase was performed. No reconciliation to current main was needed within this worker branch.

## Recommended Next Tasks

- Add durable virtual-currency balance storage only if Spacebar decides to support an Orbs ledger.
- Implement redeem/purchase flows separately, with durable provider-backed accounting and gateway/payment side effects, if those routes are assigned later.

## Integration Acceptance

- Reconciled onto `codex/merge-ready-prs-20260508` at `d6b39281f Implement creator monetization marketing onboarding route`.
- Ported only the worker-owned route, response schema, schema export, focused route test, and this report; regenerated schemas, OpenAPI, source catalog, missing-route report, testing manifest, HTTP contracts, and suite coverage from current main.
- Current-main movement: `missing = 592 -> 591`, `spacebar = 588 -> 589`, `discord = 1128`.
- Current assigned-route check: `GET /users/@me/virtual-currency/balance` is absent from `packages/missing-routes/missing.json`.
- Current verification passed: `build:src:tsgo`, `generate:schema`, `generate:openapi`, source-catalog import, missing-routes regeneration, `generate:testing-manifest`, `generate:contract-tests`, `generate:suite-coverage`, `build:test-fixtures`, focused route test, manifest verify/test, generated contract check/tests, suite coverage check/test, `lint`, `git diff --check`, and package/lockfile guard.
- `npm run test:contracts` passed static/generated contract checks and failed only on the known unrelated runtime baseline `api:http:GET:/discovery/search` returning `500 !== 200`.
