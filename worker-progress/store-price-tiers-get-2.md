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

# store-price-tiers-get-2 Progress

## Goal Evidence

- Worker `create_goal`: created an active goal for production-ready support of
  `/store/price-tiers`.
- Worker `get_goal`: confirmed active status with the assigned route objective.
- Worker final `update_goal(status: "complete")`: completed after
  implementation, regeneration, verification, and handoff report drafting.
  Tool result reported `281251` tokens and `586` seconds.

## Assignment

- Worker id: `store-price-tiers-get-2`
- Assigned path: `/store/price-tiers`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Expected missing entry: `GET_STORE_PRICE_TIERS`
- Out-of-scope adjacent paths: `/store/price-tiers/{param}` and store listing,
  SKU, subscription-plan, storefront, and billing routes.

## Evidence

- Current-base `packages/missing-routes/missing.json` had one owned entry for
  `GET /store/price-tiers` before the merge.
- Current-base source catalog had no `/store/price-tiers` entry before this
  route was added.
- Userdoccers catalog maps `GET /store/price-tiers` to
  `userdoccers:resources/store.mdx` with summary `Get Store Price Tiers`.
- xHyroM catalog maps `PRICE_TIERS` to `/store/price-tiers`; xHyroM
  `HEAD`/`OPTIONS` entries are ignored by the missing-route CLI defaults.
- Userdoccers documents the route as returning a list of integer store price
  tiers and an optional `price_tier_type` query where `1` means guild role
  subscriptions and `2` means guild products.

## Behavior

- Auth mode: bearer-authenticated. The route is not in
  `NO_AUTHORIZATION_ROUTES`; focused tests assert the auth boundary, and route
  metadata declares `401: { body: "APIErrorResponse" }`.
- Response schema: `StorePriceTiersResponse`, generated as an array of
  integers.
- Data source: injectable `StorePriceTiersProvider`. The production default
  returns `[]` because Spacebar does not currently persist Discord store
  monetization price tier catalogs.
- Query parsing: optional `price_tier_type` is parsed as an integer and passed
  to the provider; invalid values are ignored.
- Error semantics: empty catalog state is a successful `200 []`, not fabricated
  billing data and not a 404.

## Changed Files

- `src/api/routes/store/price-tiers.ts`
- `src/schemas/responses/StorePriceTiersResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/store-price-tiers-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Verification

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; wrote 869 schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` -
  passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` -
  passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; current-base
  report moved `736 -> 735` missing and `444 -> 445` implemented.
- `npm run generate:testing-manifest` - passed; wrote 550 entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` -
  initially reported stale generated contract JSON; `npm run
generate:contract-tests` passed with 525 contracts, and the rerun check
  passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; specification contains 354 paths and
  869 schemas and still reports the pre-existing webhook route metadata
  warnings.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/store-price-tiers-route.test.js` -
  passed, 4 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` -
  passed, 13 tests.

## Missing-Route Count Movement

- Before current-base regeneration: `missing = 736`, `spacebar = 444`,
  `discord = 1128`.
- After current-base regeneration: `missing = 735`, `spacebar = 445`,
  `discord = 1128`.
- Exact owned entry after regeneration: no `GET /store/price-tiers` entry
  remains in `missing_entries[]`.

## Risks And Follow-Ups

- Spacebar still has no persisted or configured price tier catalog. The route
  intentionally returns `[]` until a real store monetization provider or model
  exists.
- `/store/price-tiers/{param}` remains missing and was intentionally left out
  of scope.
