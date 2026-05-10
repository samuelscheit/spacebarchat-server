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

# Worker Progress: store-price-tiers-param-get

## Goal Evidence

- `create_goal`: active goal created for objective `Implement production-ready support for the missing route path GET /store/price-tiers/{param} on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal`: status `active`; objective `Implement production-ready support for the missing route path GET /store/price-tiers/{param} on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Final `update_goal(status: "complete")`: completed after implementation,
  regeneration, verification, and handoff report drafting. Tool result reported
  `269793` tokens and `603` seconds.

## Assignment

- Worker id: `store-price-tiers-param-get`
- Assigned path: `/store/price-tiers/{param}`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Owned missing entry: `GET_STORE_PRICE_TIERS_PRICE_TIER`
- Source reference: `userdoccers:resources/store.mdx`
- Source route: `/store/price-tiers/{price_tier}`
- Out-of-scope adjacent paths: `/store/price-tiers`, `/store/eulas/{param}`,
  `/store/listings`, `/store/published-listings/**`, storefront, SKU,
  subscription-plan, and billing routes.

## Evidence

- `packages/missing-routes/missing.json` had exactly one owned entry for
  `/store/price-tiers/{param}`: `GET_STORE_PRICE_TIERS_PRICE_TIER`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  had no `/store/price-tiers/{price_tier}` entry before implementation; it only
  had nearby `GET /store/price-tiers`.
- `src/api/routes/store` had no parameterized price-tier route before
  implementation.
- Userdoccers local catalog maps `GET /store/price-tiers/{price_tier}` to
  `userdoccers:resources/store.mdx` with summary `Get Store Price Tier`.
- Userdoccers source URL used:
  `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/store.mdx`.
  The source describes the route as returning a map of lower-cased ISO 4217
  currency codes to integer prices for the given price tier.
- xHyroM route catalog has no matching `/store/price-tiers/{price_tier}` entry.

## Behavior

- Auth mode: bearer-authenticated. The route is not a no-authorization route,
  and metadata declares `401: { body: "APIErrorResponse" }`.
- Path param handling: `price_tier` must be a non-negative safe integer string
  with no leading zero ambiguity except `0`; invalid values throw
  `DiscordApiErrors.INVALID_FORM_BODY` and metadata declares `400`.
- Response schema: `StorePriceTierResponse`, generated as an object map with
  integer additional properties.
- Data source: injectable `StorePriceTierProvider`. The production default
  returns `{}` because Spacebar does not persist Discord store monetization
  price tier catalogs yet.
- Error semantics: `401` for missing bearer auth, `400` for malformed
  `price_tier`, and `200 {}` for a valid tier when Spacebar has no durable
  localized pricing data. No monetization or regional pricing data is
  fabricated.

## Changed Files

- `src/api/routes/store/price-tiers/#price_tier.ts`
- `src/schemas/responses/StorePriceTierResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/store-price-tier-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/store-price-tiers-param-get.md`

## Verification

- Current-base port: scoped files were ported onto `672a596a8 Implement guild
preview route`; old-base generated artifacts were regenerated instead of
  copied.
- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; found 406 schemas and wrote 875 schema
  definitions.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` -
  passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; reported
  `Spacebar is missing 729`, `Spacebar implements 451`, `Discord implements
1128`.
- `npm run generate:testing-manifest` - passed; wrote 556 entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` -
  initially reported stale generated contracts.
- `npm run generate:contract-tests` - passed; wrote 531 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed
  after regeneration.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; specification contains 359 paths and 875
  schemas. The pre-existing webhook route-metadata warnings remain.
- `npm run build:test-fixtures` - passed.
- `NODE_OPTIONS=--preserve-symlinks node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/store-price-tier-route.test.js dist-test/test/routes/store-price-tiers-route.test.js` -
  passed, 9 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` -
  passed, 13 tests.
- `npx eslint src/api/routes/store/price-tiers/#price_tier.ts src/schemas/responses/StorePriceTierResponse.ts src/schemas/responses/index.ts test/routes/store-price-tier-route.test.ts` -
  passed.
- `npx prettier --check src/api/routes/store/price-tiers/#price_tier.ts src/schemas/responses/StorePriceTierResponse.ts src/schemas/responses/index.ts test/routes/store-price-tier-route.test.ts worker-progress/store-price-tiers-param-get.md` -
  failed initially for copied files; source/schema/test files were formatted
  with Prettier and the check was rerun.
- `git diff --check` - passed.
- Package manifest/lockfile cleanliness check - passed; no package manifest or
  lockfile changes.
- Changed-file malformed warranty-string scan - passed.

## Missing-Route Count Movement

- Before regeneration on current base: `missing = 730`, `spacebar = 450`,
  `discord = 1128`, owned entries for `/store/price-tiers/{param}` = `1`.
- After regeneration on current base: `missing = 729`, `spacebar = 451`,
  `discord = 1128`,
  owned entries for `/store/price-tiers/{param}` = `0`.

## Risks And Follow-Ups

- Spacebar still has no persisted or configured Discord store price-tier
  catalog. The new route intentionally returns an empty pricing map until a real
  monetization data source exists.
- If future store monetization storage is added, wire it behind
  `StorePriceTierProvider` and add tests for known tier lookup and not-found
  semantics.
- Adjacent store, SKU, storefront, billing, EULA, and published-listing routes
  remain out of scope for this worker.
