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

# Worker Progress: promotions-get-2

## Goal Evidence

- Worker `get_goal` after setup reported status `active`.
- Worker objective: implement production-ready `GET /promotions` support on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- Tmux pane showed final worker goal completion after verification; goal tool reported 158,884 tokens and 495 seconds.

## Summary

Implemented only `GET /promotions` for the assigned missing route path `/promotions`.

The route is bearer-authenticated, documents the Userdoccers `locale` and `platform` query parameters, returns a typed eligible-promotions list, and includes explicit `200` and `401` response metadata. Spacebar has no promotion catalog or eligibility provider today, so the compatibility implementation returns an empty list instead of fabricating active promotions.

## Assigned Route

- Assigned missing route path: `/promotions`.
- Missing methods found: `GET`.
- Expected route name from current-base report: `GET_PROMOTIONS`.
- Implemented methods: `GET`.
- Adjacent outbound, BOGO, claimed promotion, promotion claim, store listing, and billing routes were not implemented.

## Source Evidence

- `packages/missing-routes/missing.json` listed `GET /promotions`, route name `GET_PROMOTIONS`, source `userdoccers:resources/promotion.mdx`, summary `Get Promotions`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` listed the same Userdoccers route.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` had no `/promotions` route.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `/promotions` route before implementation.
- Userdoccers raw source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/promotion.mdx`.
- Userdoccers documents `Get Promotions` as returning promotion objects the current user is eligible for, with optional `locale` and `platform` query parameters.
- Existing local pattern: `GET /bogo-promotions` already uses the same empty-list compatibility behavior for a promotion-list endpoint.

## Changed Files

- `src/api/routes/promotions.ts`
- `src/schemas/responses/PromotionResponse.ts`
- `test/routes/promotionsRoute.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/promotions-get-2.md`

## Behavior Summary

- `GET /promotions` is bearer-authenticated in generated metadata.
- `200` returns `PromotionsResponse`.
- `401` returns `APIErrorResponse`.
- `PromotionsResponse` is an array of `PromotionResponse` objects.
- The endpoint currently returns `[]` because there is no local promotion catalog, promotion redemption state, or eligibility source to query.
- The route has no persistence, gateway, or audit-log side effects.

## Current-Base Regeneration Results

- Missing routes moved from `775 missing / 405 implemented` to `774 missing / 406 implemented`.
- `packages/missing-routes/missing.json` no longer contains `/promotions` or `GET_PROMOTIONS`.
- `routes.source.catalog.json` contains `GET /promotions`, route name `GET_PROMOTIONS`, source `src/api/routes/promotions.ts`, and response refs `APIErrorResponse` and `PromotionsResponse`.
- `assets/testing-manifest.json` contains `api:http:GET:/promotions/` with bearer auth, query metadata, `200`/`401` statuses, and `APIErrorResponse`/`PromotionsResponse` bodies.
- `assets/openapi.json` contains `GET /promotions/` with bearer security, `locale` and `platform` query parameters, and responses `200` and `401`.
- `assets/schemas.json` contains `PromotionsResponse` as an array of `PromotionResponse`.
- `test/generated/http-contracts.json` contains `api:http:GET:/promotions/`.

## Verification Commands

- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build:test-fixtures`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run generate:openapi`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/promotionsRoute.test.js`
- Final `npm run build:src:tsgo`
- `git diff --check`
- Malformed warranty-token scan over changed files
- Package and lockfile diff guard

## Focused Test Coverage

- Manifest id for `api:http:GET:/promotions/`.
- Empty-list behavior and fresh array allocation.
- HTTP response shape for the route module.
- Route metadata for summary, query params, `PromotionsResponse`, and `APIErrorResponse`.
- Bearer-auth classification.
- Generated schema, OpenAPI, and testing manifest metadata.

## Risks

- No local promotion catalog or eligibility provider exists yet, so the route intentionally returns an empty list.
- Query parameters are documented but not otherwise used while the returned list is empty.
- `npm run generate:openapi` still reports pre-existing webhook route-metadata warnings unrelated to this route.
