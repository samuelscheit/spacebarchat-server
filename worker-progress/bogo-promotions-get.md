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

# bogo-promotions-get

## Goal Evidence

- Goal status captured immediately after setup with `get_goal`: `active`.
- Goal objective captured immediately after setup: `Implement production-ready support for the assigned missing route path /bogo-promotions on the current-base worker branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`

## Summary

Implemented only `GET /bogo-promotions` for the assigned missing route path `/bogo-promotions`.

The route is bearer-authenticated, documents the Userdoccers `locale` query parameter, returns the current eligible BOGO promotion list, and includes explicit `200` and `401` response metadata. Spacebar has no promotion catalog or eligibility provider today, so the compatibility implementation returns an empty list instead of fabricating commerce state.

## Assigned Route

- Assigned missing route path: `/bogo-promotions`
- Missing methods found: `GET`
- Expected route name from current-base report: `GET_BOGO_PROMOTIONS`
- Implemented methods: `GET`
- Missing-route movement on current base: `788 -> 787`
- Assigned entry remaining after regeneration: `0`

## Source Evidence

- Missing route source entry before implementation: `packages/missing-routes/missing.json` listed `GET /bogo-promotions` from `userdoccers:resources/promotion.mdx` and `xhyrom:data/client/routes.json`.
- Userdoccers catalog entry: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` listed `GET /bogo-promotions`, route name `GET_BOGO_PROMOTIONS`, summary `Get BOGO Promotions`.
- xHyroM catalog entry: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` listed `GET /bogo-promotions`, route name `BOGO_PROMOTIONS`.
- Userdoccers raw source checked: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/promotion.mdx`.
- Relevant Userdoccers facts: the BOGO endpoint is the same promotion list shape as `Get Promotions`, but filtered to promotion type `BOGO`; it documents only `locale?` as the BOGO query parameter; promotion objects include IDs, start/end timestamps, `promotion_type`, optional marketing fields, optional restricted-country arrays, optional partner ID, and optional marketing components.
- Local source catalog before implementation had no `/bogo-promotions` entry.

## Changed Files

- `src/api/routes/bogo-promotions.ts`
- `src/schemas/responses/PromotionResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/bogoPromotionsRoute.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/bogo-promotions-get.md`

## Behavior Summary

- `GET /bogo-promotions` is bearer-authenticated in generated metadata.
- `200` returns `BogoPromotionsResponse`.
- `401` returns `APIErrorResponse`.
- `BogoPromotionsResponse` is an array of `BogoPromotionResponse` objects whose `promotion_type` schema is constrained to `1`.
- The endpoint currently returns `[]` because there is no local promotion catalog, promotion redemption state, or eligibility source to query.
- The route has no persistence, gateway, or audit-log side effects.

## Artifact Evidence

- `routes.source.catalog.json` now contains `GET_BOGO_PROMOTIONS` at `/bogo-promotions`, sourced from `src/api/routes/bogo-promotions.ts`, with response refs `APIErrorResponse` and `BogoPromotionsResponse`.
- `packages/missing-routes/missing.json` no longer contains a `/bogo-promotions` missing entry.
- `assets/testing-manifest.json` now contains `api:http:GET:/bogo-promotions/` with `authMode: "bearer"`, response bodies `APIErrorResponse` and `BogoPromotionsResponse`, response statuses `200` and `401`, and `hasQuery: true`.
- `assets/openapi.json` contains `GET /bogo-promotions/` with bearer security, `locale` query parameter, and responses `200` and `401`.
- `assets/schemas.json` contains `PromotionResponse`, `BogoPromotionResponse`, and `BogoPromotionsResponse`.
- `test/generated/http-contracts.json` contains `api:http:GET:/bogo-promotions/`.

## Commands Run

- `npm run build:src:tsgo` initially failed because this worktree had no `node_modules` and `@types/node` was unavailable.
- `npm ci` passed, installed dependencies from the existing `package-lock.json`, and did not change lockfiles.
- `npm run build:src:tsgo` passed after dependency installation.
- `npm run generate:schema` passed after adding promotion response schemas; current-base run wrote 787 schemas.
- `npm run generate:openapi` passed; current-base run wrote 312 paths / 787 schemas. Existing unrelated webhook route metadata warnings remain.
- `npm run generate:testing-manifest` passed: 498 entries.
- `node scripts/testing-manifest/verify.js` passed: 498 entries.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed: `Spacebar is missing 787`; `Spacebar implements 393`.
- `npm run generate:contract-tests` passed: 473 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` passed: 473 contracts.
- `npm run generate:suite-coverage` passed: 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: 13/13 tests.
- `npm run build:test-fixtures` passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/bogoPromotionsRoute.test.js` passed: 5/5 tests.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock --exit-code` passed.
- Required malformed warranty-token scan passed with no output after this report was added.

## Risks And Blockers

- No blockers remain for the assigned route.
- The response is intentionally empty until a real promotion catalog and eligibility provider exist. This avoids inventing commerce state.
- The route documents `locale` in metadata but does not otherwise use it while the returned list is empty.

## Recommended Next Tasks

- Implement broader `/promotions` and outbound promotion routes separately if assigned.
- Add a real promotion data source and eligibility layer before returning non-empty promotion objects.
