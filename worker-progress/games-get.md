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

# GET /games Worker Handoff

## Goal Evidence

- `create_goal` objective: Implement production-ready support for the assigned missing route path /games on the current-base worker branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- `get_goal` immediately after creation returned status `active` with the same objective.

## Assignment

- Assigned path: `/games`
- Missing methods found in `packages/missing-routes/missing.json` before implementation: `GET /games` / `GET_GAMES`
- Implemented methods: `GET /games`
- Missing-route count movement on current base: `787 -> 786`; `/games` was removed from `routes[]` and `missing_entries[]`.

## Source Evidence

- Userdoccers catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `GET /games`, route name `GET_GAMES`, source `userdoccers:resources/game.mdx`, summary `Get Games`.
- Userdoccers source doc: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/game.mdx`
  - Documents `GET /games`.
  - Documents query parameters `game_ids` as an array of 1-25 application ID snowflakes and `with_supplemental_data` as an optional boolean defaulting to true.
  - Documents the response as an array of game objects.
- xHyroM catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` has no `/games` entry; the missing-route entry for this method was Userdoccers-only.
- Existing Spacebar source: `GET /games/{game_id}` already had local `Application` to game response behavior, so the new bulk route reuses the same serializer via `src/api/util/utility/GameResponse.ts`.

## What Changed

- Added `src/api/routes/games/index.ts`
  - Implements authenticated `GET /games`.
  - Validates `game_ids` is present, 1-25 values, and snowflake-shaped.
  - Accepts repeated query params, `game_ids[]`, and comma-separated values.
  - Supports `with_supplemental_data`, defaulting to true.
  - Queries local `Application` rows and returns serialized game responses in requested order, omitting unknown IDs from the bulk list.
  - Declares explicit `200`, `400`, and `401` response metadata.
- Added `src/api/util/utility/GameResponse.ts`
  - Moved shared `GameApplication`, `shouldIncludeGameSupplementalData`, and `serializeApplicationGame` helpers out of a route file.
  - This avoids OpenAPI scanner side effects from route-to-route imports while keeping the existing single-game route behavior intact.
- Updated `src/api/routes/games/#game_id/index.ts`
  - Re-exports the shared helpers for existing tests/imports and uses the utility implementation.
- Updated `src/schemas/responses/GameResponse.ts`
  - Added `GamesResponse = GameResponse[]`.
- Added `test/routes/games-list.test.ts`
  - Covers query parsing/validation, response order, supplemental-data defaulting, field-error output, schema generation, OpenAPI metadata, manifest metadata, and bearer auth metadata.
- Regenerated:
  - `assets/schemas.json`
  - `assets/testing-manifest.json`
  - `assets/openapi.json`
  - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `packages/missing-routes/missing.json`
  - `test/generated/http-contracts.json`

## Verification

- `npm ci` passed after the first build showed `node_modules/@types/node` was missing; package manifests and lockfiles remained unchanged.
- `npm run build:src:tsgo` passed.
- `npm run build:test-fixtures` passed.
- Focused compiled tests:
  - Bare `node --test dist-test/test/routes/games-list.test.js dist-test/test/routes/games-get.test.js` failed because compiled tests need module-alias registration for `@spacebar/*`.
  - `node -r module-alias/register --test dist-test/test/routes/games-list.test.js dist-test/test/routes/games-get.test.js` passed: 14 tests passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed and wrote missing count `786`, implemented count `394`.
- `npm run generate:schema` passed and wrote `788` schemas.
- `npm run generate:testing-manifest` passed with `499` entries.
- `node scripts/testing-manifest/verify.js` passed with `499` entries.
- `npm run generate:contract-tests` passed with `474` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` passed with `474` contracts.
- `npm run generate:suite-coverage` passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: 13 tests passed.
- `npm run generate:openapi` passed and wrote 313 paths / 788 schemas. It still reports 3 pre-existing missing `route()` middleware warnings for webhook routes.
- OpenAPI sanity check passed: `/games/` uses `GamesResponse`, `game_ids` is required, and `/games/{game_id}/` still uses `GameResponse`.
- Source catalog sanity check passed: `GET /games` is present with `GamesResponse` and `APIErrorResponse`.
- Missing-route sanity check passed: `/games` has no remaining missing entries.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock --exit-code` passed.
- Malformed warranty-token scan passed.

## Risks And Notes

- Userdoccers documents a list response but does not specify unknown-ID handling. The implementation treats this as a bulk lookup and omits unknown IDs rather than failing the entire list, matching typical bulk-list behavior and avoiding a mismatch with the existing single-item route's 404 semantics.
- Local persistence only has a subset of Discord game catalog metadata; the route returns the same local game shape as `GET /games/{game_id}`.
- xHyroM did not provide additional behavior evidence for this route.

## Recommended Next Tasks

- Orchestrator merge review for `/games`.
- No package manifest or lockfile edits are required.
