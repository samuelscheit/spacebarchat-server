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

# applications-games-supplemental-get

## Summary

Implemented only `GET /applications/games-supplemental`.

The route is bearer-authenticated, parses bulk application IDs from
`application_ids` / `application_ids[]` and compatible `game_ids` aliases,
loads only local `Application` fields that can support `GameSupplementalData`,
and returns an ordered array of supported supplemental records. Unknown IDs are
omitted from the bulk response. It does not fabricate SKUs, storefront state,
install branches, release dates, reviews, trailers, Steam/OpenCritic data, or
other private catalog fields.

## Assigned Route

- Assigned path: `/applications/games-supplemental`
- Assigned method: `GET`
- Missing methods found at start: `GET`, `PATCH`, `PUT`
- Methods implemented: `GET`
- Adjacent methods intentionally untouched: `PATCH /applications/games-supplemental`, `PUT /applications/games-supplemental`
- Adjacent routes intentionally untouched: `/applications/public`, `/applications/shelf`, application storefront routes, game-claims routes, activity instance routes, OAuth, billing, subscriptions, entitlements, and unrelated application routes

## Missing Route Movement

- Before regeneration on worker base `9cdd20695`: `missing: 570`, `spacebar: 610`
- After regeneration on worker base: `missing: 569`, `spacebar: 611`
- Current-main integration target from `43ebc35e9`: expected movement after regeneration is `missing: 568 -> 567`, `spacebar: 612 -> 613`.
- `GET /applications/games-supplemental` is removed from `packages/missing-routes/missing.json` after regeneration.
- `PATCH` and `PUT` entries for `/applications/games-supplemental` remain in `missing_entries[]`.

## Evidence

- `packages/missing-routes/missing.json` initially listed `GET`, `PATCH`, and `PUT` for `/applications/games-supplemental`, all sourced from `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `GET`, `HEAD`, `OPTIONS`, `PATCH`, and `PUT` for `/applications/games-supplemental` with route name `APPLICATIONS_GAMES_SUPPLEMENTAL`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` has no Userdoccers entry for `/applications/games-supplemental`; nearby `resources/game.mdx` evidence covers `/games`, `/games/{game_id}`, and detectable game routes only.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `/applications/games-supplemental` source entry before implementation and now has `GET /applications/games-supplemental`.
- Local game response implementation in `src/api/util/utility/GameResponse.ts`, `src/api/routes/games/index.ts`, and `src/api/routes/games/#game_id/index.ts` already defines the supported local supplemental shape from durable `Application` metadata.
- Live unauthenticated probe to `https://discord.com/api/v10/applications/games-supplemental` returned `401`, matching the bearer-authenticated local implementation.

## Changed Files

- `src/api/routes/applications/games-supplemental.ts`
- `src/api/util/utility/GameResponse.ts`
- `src/schemas/responses/GameResponse.ts`
- `test/routes/applications-games-supplemental.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/applications-games-supplemental-get.md`

## Behavior And Artifacts

- New response schema: `ApplicationsGamesSupplementalResponse = GameSupplementalData[]`.
- New source route catalog entry:
    - `method`: `GET`
    - `route`: `/applications/games-supplemental`
    - `route_name`: `GET_APPLICATIONS_GAMES_SUPPLEMENTAL`
    - `response_schema_refs`: `APIErrorResponse`, `ApplicationsGamesSupplementalResponse`
- Testing manifest entry:
    - `id`: `api:http:GET:/applications/games-supplemental/`
    - `authMode`: `bearer`
    - statuses: `200`, `400`, `401`
- OpenAPI path:
    - `GET /applications/games-supplemental/`
    - `application_ids` required query parameter
    - bearer security
    - no `PATCH` or `PUT` operations generated for this path

## Worker Verification On Base `9cdd20695`

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci` passed; package and lockfile guard later confirmed no manifest/lockfile diffs.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` passed and wrote 1147 schemas.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` passed and wrote 501 paths / 1147 schemas; pre-existing webhook route-metadata warnings remain.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` passed: `Spacebar is missing 569`, `Spacebar implements 611`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` passed: 716 entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` passed: 691 contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` passed: 15 suites.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` passed.
- Focused compiled tests passed: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/applications-games-supplemental.test.js dist-test/test/routes/games-get.test.js dist-test/test/routes/games-list.test.js` with 19/19 tests passing.
- Generated tests passed: `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` with 13/13 tests passing.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock --exit-code` passed.
- Changed-file malformed warranty-token scan passed.

## Current-Main Integration Verification

The orchestrator reconciled the scoped source, test, schema, and report changes
onto current main `43ebc35e9`, regenerated all route artifacts on that base,
and did not copy old generated artifacts from the worker worktree.

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` passed and wrote 1151 schemas.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` passed and wrote 503 paths / 1151 schemas; pre-existing webhook route-metadata warnings remain.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` passed: `Spacebar is missing 567`, `Spacebar implements 613`, `Discord implements 1128`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` passed: 718 entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` passed: 693 contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` passed: 15 suites.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` passed.
- Focused source route/game tests passed 19/19: `npm run test -- test/routes/applications-games-supplemental.test.ts test/routes/games-get.test.ts test/routes/games-list.test.ts`.
- Focused built route/game tests passed 19/19: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/applications-games-supplemental.test.js dist-test/test/routes/games-get.test.js dist-test/test/routes/games-list.test.js`.
- Generated contract and suite tests passed 13/13: `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`.
- Targeted ESLint passed for the changed route, utility, schema, and test files.
- Targeted Prettier check passed for the changed route, utility, schema, test, and report files.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock --exit-code` passed.
- Changed-file malformed warranty-token scan passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` failed only on the known unrelated runtime contract `api:http:GET:/discovery/search` returning `500 !== 200`; the generated static contract checks and other runtime contracts passed or were skipped as before.

## Risks And Notes

- Discord's exact response body for this xHyroM-only route is not documented in checked-in Userdoccers evidence. The implementation uses a conservative local response schema that matches Spacebar's existing `GameSupplementalData` model rather than inventing private client catalog data.
- The route requires at least one application/game ID and caps input at 100 IDs to avoid unbounded application enumeration.
- Any future work for PATCH/PUT or full catalog behavior should be assigned separately and should define durable storage before returning richer metadata.
