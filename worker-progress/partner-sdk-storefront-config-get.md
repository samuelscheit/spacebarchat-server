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

# partner-sdk-storefront-config-get Progress

## Goal Evidence

- `create_goal`: created active goal for objective `Implement production-ready support for the missing route path `/partner-sdk/storefront-config` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal` after setup: status `active`; same objective confirmed.
- `get_goal` before handoff: status `active`; tokens used `239031`; time used `622s`.
- Final `update_goal(status: "complete")`: complete; time used `653s`; final token usage reported by tool `243726`.

## Assignment

- Worker id: `partner-sdk-storefront-config-get`
- Assigned path: `/partner-sdk/storefront-config`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Missing route entry: `GET_PARTNER_SDK_STOREFRONT_CONFIG`
- Out of scope and not implemented: adjacent `/partner-sdk/**` mutation routes, `/store/**`, `/storefront/**`, `/social-sdk/**`, application directory routes, SKU/listing routes, and entitlement routes.

## Evidence

- `packages/missing-routes/missing.json` had exactly one owned item: `GET /partner-sdk/storefront-config`, source `userdoccers:resources/store.mdx`, summary `Get Social Layer Storefront Config`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no existing `/partner-sdk/storefront-config` source route before implementation.
- `src/api/routes/**` had no existing exact path before implementation.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/store.mdx`, section `Get Social Layer Storefront Config`, says the route returns the currently running Social Layer storefront promotion with `promotional_sku_ids` and nullable `promotion_end_datetime`.
- Local runtime capture evidence in `packages/automatic-reverse-engineering/data/coverage/2026-05-07T23-06-28Z-canary-stable-smoke/routes.coverage.md` and related run events showed authenticated `GET /partner-sdk/storefront-config` returning 200 with `promotional_sku_ids`, `promotion_end_datetime`, `storefronts`, and optional announcement modal config shape.
- Auth evidence: captured requests carried an authorization header, Userdoccers is user-token focused, and `isNoAuthorizationRoute("GET", "/partner-sdk/storefront-config")` is false.

## Behavior

- Added `GET /partner-sdk/storefront-config/` under bearer auth.
- Response schema: `PartnerSdkStorefrontConfigResponse`.
- Default response is conservative and non-fabricated:
    - `promotional_sku_ids: []`
    - `promotion_end_datetime: null`
    - `storefronts: []`
- Optional provider hook allows future source-backed partner storefront config without changing route metadata.
- Error semantics: normal Spacebar auth middleware returns `401 APIErrorResponse` when authorization is absent or invalid; no custom 4xx/5xx paths were added because the default provider has no failure mode.

## Changed Files

- `src/api/routes/partner-sdk/storefront-config.ts`
- `src/schemas/responses/PartnerSdkStorefrontConfigResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/partner-sdk-storefront-config-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/partner-sdk-storefront-config-get.md`

## Current-Base Porting Notes

- The worker's unrelated `src/api/util/handlers/ChannelMessageCreateRoute.ts` annotation was not ported because `npm run build:src:tsgo` passed on the current integration base without it.
- Generated artifacts were regenerated on current `upstream/master` after the store EULA merge, not copied from the worker's older base.

## Verification

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed.
- `npm run build:test-fixtures`: passed.
- Focused route/schema/generated-artifact test: `NODE_OPTIONS=--preserve-symlinks node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/partner-sdk-storefront-config-route.test.js`: passed, 4 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; missing count now `727`, implemented count `453`, Discord total `1128`.
- `npm run generate:testing-manifest`: passed; manifest has `558` entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale, then passed after `npm run generate:contract-tests`.
- `npm run generate:contract-tests`: passed; generated `533` contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `npm run generate:openapi`: passed; OpenAPI has `361` paths and `880` schemas.
- `npx eslint src/api/routes/partner-sdk/storefront-config.ts src/schemas/responses/PartnerSdkStorefrontConfigResponse.ts src/schemas/responses/index.ts test/routes/partner-sdk-storefront-config-route.test.ts`: passed.
- `npx prettier --check src/api/routes/partner-sdk/storefront-config.ts src/schemas/responses/PartnerSdkStorefrontConfigResponse.ts src/schemas/responses/index.ts test/routes/partner-sdk-storefront-config-route.test.ts worker-progress/partner-sdk-storefront-config-get.md`: passed after formatting the test and report.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: no package manifest or lockfile changes.
- Changed-file malformed warranty-string scan: passed.

## Generated Artifact Evidence

- Source catalog now contains `GET_PARTNER_SDK_STOREFRONT_CONFIG` at `src/api/routes/partner-sdk/storefront-config.ts` with response schemas `APIErrorResponse` and `PartnerSdkStorefrontConfigResponse`.
- Testing manifest now contains `api:http:GET:/partner-sdk/storefront-config/` with bearer auth and response statuses `[200, 401]`.
- OpenAPI now contains `/partner-sdk/storefront-config/` with bearer security and 200/401 response schemas.
- Generated HTTP contracts now contain `api:http:GET:/partner-sdk/storefront-config/`.

## Missing Route Count Movement

- Before current-base regeneration: `728`
- After current-base regeneration: `727`
- Owned route still missing: `false`

## Risks And Blockers

- No blocker remains.
- The route intentionally does not invent Social Layer SKU, storefront, guild, game, price, or announcement data. Until Spacebar has a persistent partner storefront config source, clients receive the documented empty/default compatibility response.

## Recommended Next Tasks

- Add a real partner Social Layer storefront configuration repository/provider if Spacebar later supports configured Social Layer storefronts.
- Audit existing OpenAPI generation warnings for the remaining routes missing route metadata; only 3 such warnings remain after the final generation.
