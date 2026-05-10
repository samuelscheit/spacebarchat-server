# store-published-listings-skus-get

## Goal Evidence

- `create_goal`: active objective set to "Implement production-ready support for the missing route path `/store/published-listings/skus` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report."
- `get_goal`: status `active`; objective matches the assigned worker objective.
- `update_goal`: status `complete`; objective achieved. Final goal time used: 681 seconds.

## Assignment

- Worker id: `store-published-listings-skus-get`
- Assigned path: `/store/published-listings/skus`
- Branch: `codex/current-missing-route-store-published-listings-skus-get`
- Missing methods found: `GET_STORE_PUBLISHED_LISTINGS_SKUS` only.
- Methods implemented: `GET /store/published-listings/skus`.
- Out-of-scope adjacent paths: `/store/published-listings/skus/{sku_id}`, `/store/published-listings/skus/{sku_id}/subscription-plans`, `/store/published-listings/skus/subscription-plans`, `/store/published-listings/applications`, `/store/skus/**`, `/storefront/**`, `/partner-sdk/**`, price-tier, EULA, SKU purchase, entitlement, and subscription-plan behavior.

## Evidence

- `packages/missing-routes/missing.json` initially had one exact owned entry: `GET /store/published-listings/skus`, route name `GET_STORE_PUBLISHED_LISTINGS_SKUS`, sources `userdoccers:resources/store.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had only adjacent source routes for `/store/published-listings/skus/{sku_id}` and `/store/published-listings/skus/{sku_id}/subscription-plans`; the exact assigned path was absent.
- `src/api/routes/store/published-listings/skus.ts` initially had only the adjacent `/:sku_id` route.
- Userdoccers store docs describe `GET /store/published-listings/skus` as "Get Application Published Store Listings", returning a list of published store listing objects with required `application_id` and optional `guild_id`, `country_code`, and `localize`; reference: `userdoccers:resources/store.mdx`, `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/store.mdx`, and `https://docs.discord.food/resources/store`.
- Local xHyroM catalog lists the exact path with `GET`, `HEAD`, and `OPTIONS`; the missing report owns only `GET`; reference: `xhyrom:data/client/routes.json` via `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`.
- Auth mode is bearer: the route is not in `NO_AUTHORIZATION_ROUTES`, and sibling store monetization routes are bearer unless explicitly public. The route declares `401: { body: "APIErrorResponse" }`.

## Behavior

- Adds `GET /store/published-listings/skus` to the existing store published-listings SKUs router.
- Parses documented query fields:
    - `application_id`: required snowflake; missing or malformed values return `400` `APIErrorResponse`.
    - `guild_id`: optional snowflake; malformed values return `400` `APIErrorResponse`.
    - `country_code`: optional string.
    - `localize`: optional boolean, accepting `true`/`1` and `false`/`0`.
- Returns `200` with `StorePublishedListingsSkusResponse`.
- Default data source is a conservative empty published listing catalog because Spacebar does not persist Discord published store listing data yet.
- Provider hook allows future durable catalog backing and focused tests without fabricating production data.
- Adjacent `/:sku_id` behavior remains behaviorally unchanged.

## Changed Files

- `src/api/routes/store/published-listings/skus.ts`
- `src/schemas/responses/StorePublishedListingsSkusResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/store-published-listings-skus-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/store-published-listings-skus-get.md`

## Verification

- Current-base `npm run build:src:tsgo`: passed without porting the worker's incidental symlink-related workaround.
- Current-base `npm run generate:schema`: passed; generated 888 schemas including `StorePublishedListingsSkusResponse`.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; `Spacebar is missing 723`, `Spacebar implements 457`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed; wrote 562 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed after current-base contract regeneration.
- `npm run generate:contract-tests`: passed; wrote 537 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed; 13 tests.
- `npm run generate:openapi`: passed; generated 365 paths and 888 schemas. Existing webhook route middleware warnings remain unrelated.
- `npm run build:test-fixtures`: passed.
- `NODE_OPTIONS=--preserve-symlinks node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/store-published-listings-skus-route.test.js`: passed; 5 tests.
- `npx eslint src/api/routes/store/published-listings/skus.ts src/schemas/responses/StorePublishedListingsSkusResponse.ts src/schemas/responses/index.ts test/routes/store-published-listings-skus-route.test.ts`: passed.
- `npx prettier --check src/api/routes/store/published-listings/skus.ts src/schemas/responses/StorePublishedListingsSkusResponse.ts test/routes/store-published-listings-skus-route.test.ts worker-progress/store-published-listings-skus-get.md`: passed.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no package manifest or lockfile diffs.
- Changed JSON artifact parse check: passed.
- Malformed warranty-string scan: passed for changed files.

## Missing-Route Movement

- Before current-base regeneration: 724 missing routes.
- After current-base regeneration: 723 missing routes.
- Exact assigned entry `GET_STORE_PUBLISHED_LISTINGS_SKUS` was removed.
- Remaining nearby missing route `/store/published-listings/skus/subscription-plans` is out of scope.

## Risks And Next Tasks

- Risk: response item shape is intentionally conservative (`unknown[]`) because Spacebar has no durable published store listing catalog model yet. This avoids fabricated listings while preserving documented list semantics.
- Risk: invalid query errors use the existing `INVALID_FORM_BODY` API error rather than a query-specific field error tree.
- Recommended next task: implement durable store listing/SKU catalog models before returning non-empty production data.
- Recommended next task: assign the separate `/store/published-listings/skus/subscription-plans` missing route to a worker.
- Recommended next task: modernize adjacent placeholder `/:sku_id` published listing behavior and metadata under a separate exact-path assignment.
