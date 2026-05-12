<!--
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

# partner-sdk-applications-param-skus-recommendations-get Progress

## Summary

- Implemented `GET /partner-sdk/applications/{application_id}/skus/recommendations`.
- The route is bearer-authenticated, validates `user_ids`, `max_recommendations`, and `include_wishlists`, requires a locally existing application, and returns a locally truthful empty recommendations result unless a future provider supplies persisted SKU recommendation data.
- Missing-route movement on this worker base: `595 -> 594`; the owned entry was removed.

## Assignment

- Worker id: `partner-sdk-applications-param-skus-recommendations-get`
- Assigned path: `/partner-sdk/applications/{param}/skus/recommendations`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Missing route entry: `GET_PARTNER_SDK_APPLICATIONS_APPLICATION_ID_SKUS_RECOMMENDATIONS`
- Current worker base: `fc5d1aded Implement current user role connections route`
- Current-main reconciliation: not needed for the assigned base; this worktree is on `fc5d1aded`.

## Evidence

- `packages/missing-routes/missing.json` initially had exactly the owned `GET /partner-sdk/applications/{param}/skus/recommendations` entry with source `userdoccers:resources/store.mdx` and source route `/partner-sdk/applications/{application_id}/skus/recommendations`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no matching Partner SDK application recommendations route before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` had no `partner-sdk` route entries.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/store.mdx`, section `Get Application SKU Recommendations`, documents `user_ids`, optional `max_recommendations`, optional `include_wishlists`, and response fields `skus`, `skus_to_user_ids`, and `application`.
- Nearby local patterns reviewed: `src/api/routes/partner-sdk/storefront-config.ts`, `src/api/routes/partner-sdk/users/@me/channels.ts`, `src/api/routes/storefront/products/skus.ts`, `src/api/routes/storefront/skus/prices.ts`, `src/api/util/utility/StoreSkuRoute.ts`, and focused Partner SDK/store tests.

## Behavior

- Added route source at `src/api/routes/partner-sdk/applications/#application_id/skus/recommendations.ts`.
- Added response schema `PartnerSdkApplicationSkuRecommendationsResponse`.
- Query support:
    - `user_ids` and `user_ids[]`: comma-separated or repeated array forms, required, 1-100 valid non-zero snowflakes.
    - `max_recommendations`: optional integer, 1-25.
    - `include_wishlists`: optional boolean, defaults to `false`.
- Application behavior:
    - Malformed or unknown application IDs fail closed with `UNKNOWN_APPLICATION`.
    - Existing applications serialize only a narrow public shell: `id`, `name`, `description`, `icon`, `type`, and `flags`.
- Recommendation behavior:
    - Default provider returns `{ skus: [], skus_to_user_ids: {} }`.
    - Provider-backed data is cloned through local SKU serialization and filters recommendation mappings to returned SKU IDs, requested user IDs, documented reasons, and the `include_wishlists` flag.
- Auth/errors:
    - Route remains behind bearer auth.
    - Declared response statuses: `200`, `400`, `401`, `404`.

## Changed Files

- `src/api/routes/partner-sdk/applications/#application_id/skus/recommendations.ts`
- `src/schemas/responses/PartnerSdkApplicationSkuRecommendationsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/partner-sdk-applications-param-skus-recommendations-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/partner-sdk-applications-param-skus-recommendations-get.md`

## Generated Artifact Evidence

- Source catalog now includes `GET /partner-sdk/applications/{application_id}/skus/recommendations` with response schemas `APIErrorResponse` and `PartnerSdkApplicationSkuRecommendationsResponse`.
- Testing manifest now includes `api:http:GET:/partner-sdk/applications/:application_id/skus/recommendations/` with bearer auth and response statuses `[200, 400, 401, 404]`.
- OpenAPI now includes `/partner-sdk/applications/{application_id}/skus/recommendations/`.
- Generated HTTP contracts now include the route.
- `packages/missing-routes/missing.json` no longer includes the owned entry.

## Adjacent Routes Intentionally Untouched

- `/partner-sdk/application/{application_id}/skus`
- `/partner-sdk/applications/{application_id}/storefront`
- `/partner-sdk/guilds/**/application-storefront`
- SKU purchase, subscription, store directory, storefront collection/product, and billing routes

## Verification

- `npm ci`: passed; installed local dependencies required for npm script verification.
- `npm run build:src:tsgo`: initially blocked before install because `tsgo` was absent, then passed after `npm ci`; final rerun passed.
- `npx prettier --write src/api/routes/partner-sdk/applications/#application_id/skus/recommendations.ts src/schemas/responses/PartnerSdkApplicationSkuRecommendationsResponse.ts src/schemas/responses/index.ts test/routes/partner-sdk-applications-param-skus-recommendations-route.test.ts`: passed.
- `npx prettier --check src/api/routes/partner-sdk/applications/#application_id/skus/recommendations.ts src/schemas/responses/PartnerSdkApplicationSkuRecommendationsResponse.ts src/schemas/responses/index.ts test/routes/partner-sdk-applications-param-skus-recommendations-route.test.ts`: passed.
- `npm run generate:schema`: passed; wrote 1113 schemas.
- `npm run generate:openapi`: passed; 477 paths and 1113 schemas; existing unrelated warnings for webhook routes without `route()` metadata remained.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; missing count `594`, implemented count `586`, Discord count `1128`.
- `npm run generate:testing-manifest`: passed; 691 entries.
- `npm run generate:contract-tests`: passed; 666 contracts.
- `npm run generate:suite-coverage`: passed; 15 suites.
- `npm run build:test-fixtures`: passed.
- `NODE_OPTIONS=--preserve-symlinks node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/partner-sdk-applications-param-skus-recommendations-route.test.js`: passed, 6 tests.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `npx eslint src/api/routes/partner-sdk/applications/#application_id/skus/recommendations.ts src/schemas/responses/PartnerSdkApplicationSkuRecommendationsResponse.ts src/schemas/responses/index.ts test/routes/partner-sdk-applications-param-skus-recommendations-route.test.ts`: passed.
- `git diff --check`: passed.
- `git diff --exit-code -- package.json package-lock.json`: passed; no package manifest or lockfile changes.
- Changed-file malformed warranty-string scan: passed.

## Risks And Blockers

- No blocker remains.
- Spacebar still has no durable local SKU recommendation, wishlist, storefront, price, or personalized recommendation store. The default response intentionally exposes no SKU recommendations instead of fabricating Discord state.
- Future work can add a real provider for persisted application SKU recommendations without changing route metadata or generated contracts.

## Integration Acceptance

- Accepted into the main checkout on 2026-05-12 from current integration base `0e6d61c85`.
- Ported only the worker-owned route, response schema, route test, schema export, generated artifacts, and worker progress report; generated files were regenerated from the main checkout.
- Current main missing-route movement after regeneration: `591 -> 590` missing, `589 -> 590` implemented, Discord `1128` unchanged.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote 1118 schemas.
- `npm run generate:openapi`: passed; wrote 481 paths and 1118 schemas with the existing unrelated webhook route metadata warnings.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route catalog import, missing-routes build, and `npm run start --workspace @spacebar/missing-routes`: passed; wrote 590 missing / 590 implemented.
- `npm run generate:testing-manifest`: passed; wrote 695 entries.
- `npm run generate:contract-tests`: passed; wrote 670 contracts.
- `npm run generate:suite-coverage`: passed; wrote 15 suites.
- `npm run build:test-fixtures`: passed.
- `npm run test -- test/routes/partner-sdk-applications-param-skus-recommendations-route.test.ts`: passed, 6 tests.
- `node scripts/testing-manifest/verify.js`: passed, 695 entries.
- `npm run generate:contract-tests -- --check`: passed, 670 contracts.
- `npm run generate:suite-coverage -- --check`: passed.
- `npm run test:manifest`: passed, 30 tests and manifest verify.
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`: passed, 10 tests.
- `npm run test:suite-coverage`: passed, 4 tests.
- `npm run lint`: passed.
- `git diff --check`: passed.
- Package and lockfile guard: passed; no package or lockfile changes.
- `npm run test:contracts`: failed only on the known unrelated baseline runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`; generated contract checks passed before that failure.
