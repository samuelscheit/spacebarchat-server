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

# games-param-get

## Goal Evidence

- Goal status captured immediately after setup with `get_goal`: `active`.
- Goal objective captured immediately after setup: `Implement production-ready support for the assigned missing route path /games/{param} on the current-base worker branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`

## Summary

Implemented only `GET /games/{game_id}` for the assigned missing route path `/games/{param}`.

The route resolves the game by local `Application.id`, returns Discord's unknown-application error when absent, and serializes the local application into a `GameResponse` DTO. It includes bearer-authenticated `401` route metadata, documents the `with_supplemental_data` query flag, includes minimal local supplemental data by default, and omits that object when `with_supplemental_data=false`.

## Assigned Route

- Assigned missing route path: `/games/{param}`
- Missing methods found: `GET`
- Expected method from current-base report: `GET /games/{game_id}`
- Source route name: `GET_GAMES_GAME_ID`
- Implemented methods: `GET`
- Missing-route movement on accepted current base: `missing` `793 -> 792`; `spacebar` `387 -> 388`
- Assigned entry remaining after regeneration: `0`

## Source Evidence

- Current-base source evidence: `userdoccers:resources/game.mdx`
- Userdoccers raw source checked: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/game.mdx`
- Relevant source facts: `Get Game` returns a `game` object for the application ID; query `with_supplemental_data?` is boolean and defaults to true; a game object is a superset of the detectable application object with optional supplemental game data and game catalog fields.
- Local source catalog before implementation had `/games/{game_id}/announcements` and `/games/detectable`, but not `/games/{game_id}`.
- No local xHyroM catalog entry was found for `GET /games/{game_id}`.

## Changed Files

- `src/api/routes/games/#game_id/index.ts`
- `src/schemas/responses/GameResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/games-get.test.ts`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/games-param-get.md`

## Behavior Summary

- `GET /games/{game_id}` is bearer-authenticated in generated metadata.
- `200` returns `GameResponse`.
- `401` and `404` return `APIErrorResponse`.
- Missing applications throw `DiscordApiErrors.UNKNOWN_APPLICATION`.
- The serializer maps local `Application` fields to Discord-compatible game fields: `id`, `name`, `icon_hash`, `cover_image_hash`, `hook`, default empty catalog arrays, and default overlay flags.
- Supplemental data currently uses local application data only: `application_id`, `name`, optional `summary`, optional `icon_hash`, and optional `announcements_channel_id`.

## Artifact Evidence

- `routes.source.catalog.json` now contains `GET_GAMES_GAME_ID` at `/games/{game_id}`, sourced from `src/api/routes/games/#game_id/index.ts`, with response refs `APIErrorResponse` and `GameResponse`.
- `packages/missing-routes/missing.json` no longer contains the `/games/{param}` entry.
- `assets/testing-manifest.json` now contains `api:http:GET:/games/:game_id/` with `authMode: "bearer"` and statuses `200`, `401`, and `404`.
- `assets/openapi.json` contains `GET /games/{game_id}/` with bearer security and responses `200`, `401`, and `404`.
- `assets/schemas.json` contains `GameResponse` and nested game DTO definitions.
- `test/generated/http-contracts.json` contains `api:http:GET:/games/:game_id/`.

## Commands Run

- `npm run build:src:tsgo` passed.
- `npm run build:test-fixtures` passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed: `Spacebar is missing 792`; `Spacebar implements 388`.
- `npm run generate:schema` passed and processed `GameResponse`; schema output contains 759 schemas.
- `npm run generate:testing-manifest` passed: 493 entries.
- `node scripts/testing-manifest/verify.js` passed: 493 entries.
- `npm run generate:contract-tests` passed: 468 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` passed: 468 contracts.
- `npm run generate:suite-coverage` passed: 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: 13/13 tests.
- `npm run generate:openapi` passed and wrote 308 paths / 759 schemas; existing unrelated webhook route metadata warnings remain.
- `npm run build:test-fixtures` passed after artifact generation.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/games-get.test.js` passed: 7/7 tests.
- `node scripts/testing-manifest/generate-contract-tests.js --check` passed after OpenAPI generation.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed after OpenAPI generation.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock --exit-code` passed.
- Changed/untracked license spelling scan passed with no output.

## Risks And Blockers

- No blockers remain for the assigned route.
- Spacebar does not currently have dedicated persistence for Discord's full game catalog metadata, executable detection data, companies, screenshots, trailers, reviews, or rank. The implementation deliberately does not invent that data; it returns local application-backed values and empty/default catalog fields.
- Future game-claim or game-catalog work can extend `GameResponse` population without changing the route contract.

## Recommended Next Tasks

- Implement `GET /games` separately if assigned; it should reuse the serializer added here.
- Add durable game catalog persistence when broader game profile/store features are assigned.
