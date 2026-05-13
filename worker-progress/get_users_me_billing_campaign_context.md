# GET /users/@me/billing/campaign-context

## Summary

Implemented the assigned authenticated `GET /users/@me/billing/campaign-context` route only. The endpoint now returns a locally truthful empty campaign-context object because Spacebar does not currently persist Discord billing campaign attribution state.

## Assigned Scope

- Worker id: `get_users_me_billing_campaign_context`
- Assigned route: `GET /users/@me/billing/campaign-context`
- Assigned route name: `CAMPAIGN_CONTEXT`
- Source: `xhyrom:data/client/routes.json`
- Implemented methods: `GET`
- Sibling routes intentionally untouched: every other `/users/@me/billing/*` missing route, plus `HEAD` and `OPTIONS` catalog entries for campaign-context.

## Changed Files

- `src/api/routes/users/@me/billing/campaign-context.ts`
- `src/api/routes/users/@me/billing/campaign-context.test.ts`
- `src/schemas/responses/BillingCampaignContextResponse.ts`
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

## Behavior

- Adds an authenticated current-user route with `route()` metadata.
- Response schema: `BillingCampaignContextResponse`, an empty object with `additionalProperties: false`.
- Runtime response: `{}`.
- Rationale: no local campaign attribution provider or durable billing campaign model exists, so the route does not fabricate Discord-managed campaign data.

## Evidence Gathered

- `packages/missing-routes/missing.json` had the assigned entry:
  - `GET /users/@me/billing/campaign-context`
  - `route_name: CAMPAIGN_CONTEXT`
  - `sources: ["xhyrom:data/client/routes.json"]`
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` contains `GET`, `HEAD`, and `OPTIONS` entries for `/users/@me/billing/campaign-context`; this worker implemented only `GET`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` did not contain the route before implementation and now contains:
  - `GET /users/@me/billing/campaign-context`
  - `route_name: GET_USERS__ME_BILLING_CAMPAIGN_CONTEXT`
  - `source: src/api/routes/users/@me/billing/campaign-context.ts`
  - `response_schema_refs: ["APIErrorResponse", "BillingCampaignContextResponse"]`
- Userdoccers billing reference checked: https://docs.discord.food/resources/billing. It documents nearby billing routes such as country-code, location-info, localized-pricing-promo, user-offer, checkout-recovery, and nitro-affinity, but not campaign-context.

## Missing-Route Movement

- Worker worktree movement: `missing: 494 -> 493`, `spacebar: 686 -> 687`, `discord: 1128`.
- Main checkout acceptance base: `6059d35ab`.
- Main checkout movement: `missing: 492 -> 491`, `spacebar: 688 -> 689`, `discord: 1128`.
- The assigned `GET /users/@me/billing/campaign-context` entry is no longer present in `missing_entries`.
- Main checkout generated artifacts now contain `794` testing-manifest entries and `769` generated HTTP contracts.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
  - Passed. Installed worktree-local dependencies required because `node_modules` was absent.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - First attempt before `npm ci` failed because `tsgo` was unavailable.
  - Passed after dependency install.
  - Passed again after final lint fix.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
  - Passed. Existing warning: 3 routes missing route metadata.
  - Main checkout note: an initial acceptance run happened before rebuilding `dist`, so `assets/openapi.json` was stale and did not include the new route. OpenAPI was regenerated again after `build:src:tsgo`, then fixtures and focused tests were rerun successfully.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
  - Passed. Wrote `packages/missing-routes/missing.json`; worker missing count was 493 and main acceptance missing count is 491.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
  - Passed. Worker manifest had 792 entries; main acceptance manifest has 794 entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
  - Passed. Worker contract matrix had 767 contracts; main acceptance contract matrix has 769 contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/billing/campaign-context.test.js`
  - Passed: 4 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check && PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
  - Failed only at the known unrelated runtime contract:
    - `api:http:GET:/discovery/search should return a successful response for schema validation`
    - `500 !== 200`
  - The generated contract check portion passed. No campaign-context contract failed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/routes/users/@me/billing/campaign-context.ts src/api/routes/users/@me/billing/campaign-context.test.ts src/schemas/responses/BillingCampaignContextResponse.ts`
  - First run found one arrow-body style issue in the new route.
  - Passed after fix.
- `git diff --check`
  - Passed.
- Package/lockfile guard:
  - `git diff -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json`
  - No diff.

## Main Checkout Acceptance

- Replayed only source, test, config, and progress-report edits from the worker; generated artifacts were regenerated on main base `6059d35ab`.
- Regenerated schemas, OpenAPI, source route catalog, missing routes, testing manifest, generated HTTP contracts, suite coverage, and test fixtures on the main checkout.
- Verified the built focused route test after the second OpenAPI regeneration: 4 tests passed.
- Verified manifest, contract, suite-coverage, public-assets, targeted ESLint, `git diff --check`, and package/lockfile guard on the main checkout.

## Risks And Blockers

- The response is intentionally empty until Spacebar has a durable local billing campaign attribution provider/model.
- `npm run test:contracts` remains blocked by the known unrelated `api:http:GET:/discovery/search` runtime `500 !== 200` failure. The runtime command also logs existing route registration errors for analytics `query` modules lacking default routers, but those were not the failing assertion.

## Recommended Next Tasks

- Implement a real campaign attribution provider/model before returning non-empty billing campaign context.
- Resolve the unrelated discovery search runtime contract failure so full `npm run test:contracts` can pass.
