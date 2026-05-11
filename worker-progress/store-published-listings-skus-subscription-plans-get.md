# store-published-listings-skus-subscription-plans-get

## Goal Evidence

- `create_goal`: created active goal for objective `Implement production-ready support for the missing route path `/store/published-listings/skus/subscription-plans` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal`: status `active`; objective matches the assigned route support objective.
- `update_goal`: status `complete`; time used `698` seconds.

## Progress

- Started from worker brief and assigned path `/store/published-listings/skus/subscription-plans`.
- Confirmed `packages/missing-routes/missing.json` contains exactly one owned missing entry: `GET /store/published-listings/skus/subscription-plans` with route name `GET_STORE_PUBLISHED_LISTINGS_SKUS_SUBSCRIPTION_PLANS`.
- Confirmed the exact route is absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` before implementation.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/store.mdx`, section "Get Bulk Published Subscription Plans".
- Userdoccers semantics gathered: required `sku_ids` array of snowflakes with 1-16 values; optional `include_unpublished`, `revenue_surface`, `country_code`, and `payment_source_id`; response is a list of published subscription plan objects for the requested SKU IDs.
- Auth evidence: the Userdoccers route header is not marked unauthenticated; adjacent `/store/published-listings/skus` and `/store/price-tiers` Spacebar routes stay behind bearer auth, while only `/store/eulas/{eula_id}` is explicitly public in no-auth middleware.

## Summary

- Implemented `GET /store/published-listings/skus/subscription-plans` in `src/api/routes/store/published-listings/skus.ts`.
- Added query parsing for `sku_ids`, `include_unpublished`, `revenue_surface`, `country_code`, and `payment_source_id`.
- Added route metadata with `200`, `400`, and authenticated `401` response declarations.
- Added a typed response schema for bulk published subscription plans.
- Reused the existing local subscription-plan source (`getSubscriptionPlansForSku` plus configured custom subscription plans) and returns only locally derivable plans. No plans are fabricated for unknown SKUs.
- Registered the exact static child route before `/:sku_id`, preserving the existing `/store/published-listings/skus` and `/store/published-listings/skus/{sku_id}` behavior.

## Scope

- Assigned path: `/store/published-listings/skus/subscription-plans`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Out-of-scope adjacent paths left unchanged: `/store/published-listings/skus`, `/store/published-listings/skus/{sku_id}`, `/store/published-listings/skus/{sku_id}/subscription-plans`, `/store/published-listings/applications`, `/store/skus/**`, billing subscription routes, entitlement routes, and SKU purchase behavior.

## Behavior

- Auth mode: bearer-authenticated.
- Success response: `200` with `StorePublishedListingsSkusSubscriptionPlansResponse`.
- Error semantics: malformed/missing `sku_ids`, too many `sku_ids`, malformed SKU IDs, or malformed `payment_source_id` return the existing invalid form body API error through `ErrorHandler`.
- Data source: built-in Discord-compatible subscription plan data plus `Config.get().store.customSubscriptionPlans`, filtered by requested SKU IDs. Unknown SKUs contribute no plans in the bulk response.
- `include_unpublished` is accepted and parsed for compatibility, but Spacebar does not currently persist published/unpublished subscription-plan state, so it does not expand the source-backed result set.

## Changed Files

- `src/api/routes/store/published-listings/skus.ts`
- `src/schemas/responses/StorePublishedListingsSkusSubscriptionPlansResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/store-published-listings-skus-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/store-published-listings-skus-subscription-plans-get.md`

## Generated Evidence

- `routes.source.catalog.json` now contains `GET /store/published-listings/skus/subscription-plans` sourced from `src/api/routes/store/published-listings/skus.ts` with response schema refs `APIErrorResponse` and `StorePublishedListingsSkusSubscriptionPlansResponse`.
- `assets/testing-manifest.json` now contains `api:http:GET:/store/published-listings/skus/subscription-plans` with bearer auth and `200/400/401` metadata.
- `test/generated/http-contracts.json` now contains the same manifest ID and response metadata.
- `assets/openapi.json` now contains `/store/published-listings/skus/subscription-plans` with documented query parameters and bearer security.
- Missing-route count moved from `723` to `722`; `spacebar` implemented count moved from `457` to `458`.
- Owned missing entry is no longer present in `packages/missing-routes/missing.json`.

## Commands Run

- `npm run build:src:tsgo` - first run failed because the initial `node_modules` symlink resolved types through the shared server path; replaced it with an ignored local dependency copy.
- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed.
- `npm run build:test-fixtures` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote missing count `722`.
- `npm run generate:testing-manifest` - passed.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - initially reported stale generated contracts.
- `npm run generate:contract-tests` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed.
- `npm run generate:openapi` - passed; pre-existing warnings remain for unrelated webhook routes without metadata.
- `npm run build:test-fixtures` - passed after final test updates.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/store-published-listings-skus-route.test.js dist-test/test/fixtures/store-subscription-plans.test.js dist-test/test/scenarios/store-published-listings.test.js` - passed.
- `node scripts/testing-manifest/verify.js` - final pass.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - final pass.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - final pass.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - final pass.
- `git diff --check` - passed.
- Package manifest/lockfile cleanliness check - passed; no package manifest or lockfile changes.
- Malformed warranty-string scan - passed for changed files.

## Dependency Hygiene

- `node_modules/` is an ignored local dependency copy used for verification. It is not part of the diff.

## Risks And Follow-Ups

- Spacebar still lacks durable published/unpublished store subscription-plan catalog persistence, so the bulk endpoint cannot reproduce Discord-only catalog state beyond built-in and configured local plans.
- Existing per-SKU subscription-plan route metadata remains sparse and unchanged because it is adjacent, not owned by this worker.
- Recommended next task: if broader store fidelity is needed, add a durable published subscription-plan catalog model and then wire both bulk and per-SKU published subscription-plan routes to that source.
