# store-published-listings-applications-get

## Goal Evidence

- `create_goal`: objective `Implement production-ready support for the missing route path `/store/published-listings/applications` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`, status `active`.
- `get_goal`: objective `Implement production-ready support for the missing route path `/store/published-listings/applications` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`, status `active`.
- Final `update_goal(status: "complete")`: status `complete`, time used `538` seconds, tokens used `227148`.

## Assignment

- Worker id: `store-published-listings-applications-get`.
- Assigned path: `/store/published-listings/applications`.
- Missing methods found: `GET GET_STORE_PUBLISHED_LISTINGS_APPLICATIONS`.
- Methods implemented: `GET /store/published-listings/applications`.
- Out-of-scope adjacent paths left untouched: `/store/published-listings/applications/{application_id}`, `/store/published-listings/applications/{application_id}/subscription-plans`, `/store/published-listings/skus`, `/store/published-listings/skus/subscription-plans`, `/store/skus/**`, billing subscription routes, entitlement routes, and SKU purchase behavior.

## Evidence Gathered

- `packages/missing-routes/missing.json` had one owned missing entry for exact route `/store/published-listings/applications`, method `GET`, with sources `userdoccers:resources/store.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` did not contain the exact assigned route before implementation; only adjacent application-id and SKU published-listings routes were present.
- `src/api/routes/**` did not contain `src/api/routes/store/published-listings/applications.ts` before implementation; adjacent `applications/#application_id/*` and `skus.ts` routes existed.
- Userdoccers `resources/store.mdx` raw GitHub source documents `GET /store/published-listings/applications` as `unauthenticated`, summary `Get Bulk Application Primary Store Listing`, returning a list of store listing objects for primary SKUs of the given application IDs. Query fields are required `application_ids` array of snowflakes, 1-100, optional `country_code`, and optional `localize` default true.
- Local xHyroM catalog records `/store/published-listings/applications` as `STORE_PUBLISHED_LISTINGS_APPLICATIONS` for `GET`, `HEAD`, and `OPTIONS`.
- After regeneration, source catalog entry is `GET /store/published-listings/applications`, route name `GET_STORE_PUBLISHED_LISTINGS_APPLICATIONS`, source `src/api/routes/store/published-listings/applications.ts`, response refs `APIErrorResponse` and `StorePublishedListingsApplicationsResponse`.

## Behavior

- Auth mode: public/no-auth for the exact assigned route. Added exact no-auth entry so `GET` and Express `HEAD` work without bearer auth. No `401` response metadata is declared.
- Query parsing: accepts repeated, comma-separated, and bracket-array `application_ids`; validates 1-100 values and snowflake format; deduplicates after validating input length; accepts optional `country_code`; parses `localize` with default `true` and rejects malformed boolean values.
- Response schema: `StorePublishedListingsApplicationsResponse = unknown[]`, matching the unmodeled store listing object list while keeping generated schemas typed as an array.
- Data source: provider-backed list with a conservative empty default. Spacebar currently has no durable Discord published primary application store listing catalog, so the route does not fabricate listings.
- Error semantics: invalid query fields raise field error `50035` and return HTTP 400 through the existing error handler.

## Changed Files

- `src/api/routes/store/published-listings/applications.ts`
- `src/schemas/responses/StorePublishedListingsApplicationsResponse.ts`
- `src/schemas/responses/index.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `test/routes/store-published-listings-applications-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/store-published-listings-applications-get.md`

## Commands Run

- `create_goal` - passed, status `active`.
- `get_goal` - passed, status `active`.
- `sed -n '1,240p' /Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md` - passed.
- `rg ... packages/missing-routes/missing.json packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json src/api/routes test` - passed; confirmed exact missing entry and route absence.
- `curl -fsSL https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/store.mdx ...` - passed; confirmed Userdoccers public route/query/response evidence.
- `npm run build:src:tsgo` - first run failed only with local `node_modules` symlink realpath portability error in pre-existing `ChannelMessageCreateRoute.ts`; reran after replacing symlink with a local ignored dependency copy and passed.
- `npm run generate:schema` - passed.
- `npm run build:test-fixtures` - passed; rerun after focused test patch also passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote missing report.
- `npm run generate:testing-manifest` - passed; wrote 564 entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - initially reported stale generated contract tests.
- `npm run generate:contract-tests` - passed; wrote 539 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, 13 tests.
- `npm run generate:openapi` - passed; generated 367 paths and 891 schemas. It reported the existing warning that 3 webhook routes are missing route metadata.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/store-published-listings-applications-route.test.js dist-test/test/routes/store-published-listings-skus-route.test.js dist-test/test/scenarios/store-published-listings.test.js` - passed, 11 focused tests.
- `git diff --check` - passed.
- Package manifest/lockfile cleanliness check - passed; no package manifest or lockfile diff.
- Changed-file malformed warranty-string scan - passed.

## Missing-Route Movement

- Before regeneration: missing count `722`; exact assigned route present.
- After regeneration: missing count `721`; exact assigned route absent.
- Current-base note: adjacent `GET /store/published-listings/skus/subscription-plans` was already implemented by `f420444d0` before this worker was accepted, so the current-base tests assert that it remains implemented and absent from the missing report.

## Risks And Blockers

- No durable published primary application store listing catalog exists in Spacebar today. The route therefore returns a truthful empty list by default while preserving a provider seam for future source-backed storage.
- Userdoccers also marks adjacent published listing routes as unauthenticated, but this worker changed only the exact assigned path. Existing `/store/published-listings/skus` bearer behavior is intentionally preserved and covered by focused tests.
- `npm run generate:openapi` still reports pre-existing webhook route metadata warnings unrelated to this change.

## Recommended Next Tasks

- Implement durable store listing persistence/serialization if Spacebar needs non-empty published application store listings.
- No remaining exact store published-listings SKU subscription-plan assignment is needed on the current base; `f420444d0` implemented it.
- Review public/no-auth policy for adjacent published listing routes in a dedicated task if the orchestrator wants full Userdoccers parity beyond this assignment.
