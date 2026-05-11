# store-skus-param-plans-get

## Summary

- Implemented `GET /store/skus/{sku_id}/plans` as a bearer-auth route in `src/api/routes/store/skus/#sku_id/plans.ts`.
- The route validates SKU IDs, resolves a locally backed SKU source, requires access to the SKU's owning application with `requireApplicationStoreAccess`, and returns only configured local `store.customSubscriptionPlans` for that SKU.
- It fails closed with `Unknown SKU` when Spacebar has no local SKU catalog/provider for the requested SKU, so it does not fabricate Discord subscription-plan data.
- Reused the existing `StorePublishedListingsSkusSubscriptionPlansResponse` response schema.
- Adjusted `src/api/routes/store/published-listings/skus.ts` to lazily require the single-SKU published subscription-plan route helper. This avoids OpenAPI route-scanner cache side effects and preserves `/store/published-listings/skus/{sku_id}/subscription-plans/` in generated OpenAPI.

## Changed Files

- `src/api/routes/store/skus/#sku_id/plans.ts`
- `test/routes/store-skus-param-plans-route.test.ts`
- `src/api/routes/store/published-listings/skus.ts`
- `test/routes/store-published-listings-skus-route.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`

## Evidence Gathered

- Confirmed `packages/missing-routes/missing.json` had exactly one assigned missing entry:
  - `GET /store/skus/{param}/plans`
  - `GET_STORE_SKUS_SKU_ID_PLANS`
  - source `userdoccers:resources/store.mdx`
  - source route `/store/skus/{sku_id}/plans`
- Confirmed `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no implemented `/store/skus/{sku_id}/plans` entry before this work.
- Confirmed `src/api/routes/store` had `src/api/routes/store/skus/#sku_id.ts` but no `#sku_id/plans.ts` route before this work.
- Userdoccers `resources/store.mdx` says `Get Subscription Plans` returns subscription plan objects for a SKU and that the user must own the SKU's application or be a member of the owning team.
- Existing local support:
  - `src/api/routes/store/skus/#sku_id.ts` already authorizes SKU access through application ownership/team membership but has no durable default SKU catalog.
  - `src/api/routes/store/published-listings/skus/#sku_id/subscription-plans.ts` contains hardcoded/built-in published plan data plus configured custom plans.
  - For this owned route, I intentionally return only configured local plans after SKU ownership is verified, because built-in published Discord/Nitro plans do not establish ownership for `/store/skus/{sku_id}/plans`.

## Missing-Route Movement

- Worker-base regeneration: `645 -> 644`.
- Current-base acceptance regeneration: `643 -> 642`, implemented routes
  `537 -> 538`, Discord routes `1128`.
- Assigned entry removed: `GET /store/skus/{param}/plans`.
- Adjacent entries remain missing and untouched:
  - `GET /store/skus/{param}/listings`
  - `GET /store/skus/{param}/purchase`

## Artifact Status

- Source route catalog contains:
  - `GET /store/skus/{sku_id}/plans`
  - route name `GET_STORE_SKUS_SKU_ID_PLANS`
  - source `src/api/routes/store/skus/#sku_id/plans.ts`
  - response refs `APIErrorResponse`, `StorePublishedListingsSkusSubscriptionPlansResponse`
- Testing manifest contains `api:http:GET:/store/skus/:sku_id/plans/`, bearer auth, no query, statuses `[200, 401, 403, 404]`.
- Current-base testing manifest contains `643` entries.
- HTTP contracts contain the same manifest id and response metadata.
- Current-base generated HTTP contracts contain `618` contracts.
- OpenAPI contains:
  - `/store/skus/{sku_id}/plans/`
  - existing `/store/skus/{sku_id}/`
  - existing `/store/published-listings/skus/{sku_id}/subscription-plans/`
- Current-base OpenAPI contains `433` paths and `1021` schemas.
- `assets/schemas.json` was not regenerated because no schema source changed; the route reuses an existing response schema.

## Commands Run

- `npm run build:src:tsgo`
  - Initial attempt failed with `TS2688: Cannot find type definition file for 'node'` because this worktree had no `node_modules`.
- `npm ci`
- `npm run build:src:tsgo`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
  - First check reported stale `test/generated/http-contracts.json`; regenerated with `npm run generate:contract-tests`.
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/store-skus-param-plans-route.test.js dist-test/test/routes/store-skus-param-route.test.js dist-test/test/routes/store-published-listings-skus-route.test.js dist-test/test/fixtures/store-subscription-plans.test.js`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/generated/http-auth-runtime-contracts.test.js`
  - Static generated tests passed first.
  - Runtime generated contract suite failed out of scope on `api:http:GET:/discovery/search` returning `500` instead of `200` in the public response-schema group.
  - The same runtime run passed the missing/malformed bearer auth groups that cover protected routes, including this new protected route class.
- `npm run test:manifest`
- `git diff --check`
- `git diff -- package.json package-lock.json`
- Malformed warranty-token scan over the changed licensed source/test files.

## Current-Base Acceptance Commands

- `npm run build:src:tsgo`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/store-skus-param-plans-route.test.js dist-test/test/routes/store-skus-param-route.test.js dist-test/test/routes/store-published-listings-skus-route.test.js dist-test/test/fixtures/store-subscription-plans.test.js`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npm run lint`
- `npm run test:contracts`
  - Failed only on known unrelated runtime contract
    `api:http:GET:/discovery/search` returning `500 !== 200`.
- `git diff --check`
- `git diff -- package.json package-lock.json`
- Malformed warranty-token scan over `src`, `test`, `packages`, `scripts`,
  `assets`, and `worker-progress`.

## Risks Or Blockers

- The route depends on a local SKU provider/catalog to prove application ownership. The default provider returns no SKU, so default production behavior is fail-closed `404 Unknown SKU` rather than exposing hardcoded Discord plan data.
- `getStorePublishedListingsSkusSubscriptionPlans` and `listStorePublishedListingsSkusSubscriptionPlans` are now async so they can avoid a route-module top-level import during artifact scanning. Repo usages were updated and focused tests pass.
- Generated runtime contract failure on `/discovery/search` is unrelated to this store route and was not changed here.

## Recommended Next Tasks

- Implement adjacent SKU routes only via their own assignments:
  - `/store/skus/{param}/listings`
  - `/store/skus/{param}/purchase`
- Add durable SKU and subscription-plan persistence if Spacebar should serve real `/store/skus/{sku_id}/plans` data without injected/local configured providers.
