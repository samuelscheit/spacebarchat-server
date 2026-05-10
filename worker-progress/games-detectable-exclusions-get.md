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

# games-detectable-exclusions-get

## Goal Evidence

- `create_goal` objective: Implement production-ready support for the assigned missing route path `/games/detectable/exclusions` on the current-base worker branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- `get_goal` immediately after setup returned status `active` with the same objective.

## Summary

Implemented `GET /games/detectable/exclusions`.

The route is public, proxies Discord's public cacheable exclusions endpoint, normalizes the response to `{ executables: string[], patterns: string[] }`, caches successful payloads for one hour, serves a warmed stale payload if refresh fails, and returns a documented `502` API error when the upstream source is unavailable before cache warmup.

## Assigned Route

- Assigned path: `/games/detectable/exclusions`
- Missing methods found at start: `GET /games/detectable/exclusions` (`GET_GAMES_DETECTABLE_EXCLUSIONS`)
- Methods implemented: `GET /games/detectable/exclusions`
- Scope intentionally not changed: `/games/detectable`, `/games/{game_id}`, game announcements, game activity/library/entitlements, and client detection routes.

## Source Evidence

- Userdoccers catalog source: `userdoccers:resources/game.mdx`
- Userdoccers route name: `GET_GAMES_DETECTABLE_EXCLUSIONS`
- Userdoccers summary: `Get Detectable Game Exclusions`
- Upstream Userdoccers file used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/game.mdx`
- Userdoccers documents the response fields as `executables` array of ignored process names and `patterns` array of regular expression patterns for process names.
- Local reverse-engineering capture showed `GET /games/detectable/exclusions` returning `200`, response shape `{ executables: string[], patterns: string[] }`, and cache header `public, max-age=3600`.
- Live unauthenticated request to `https://discord.com/api/v10/games/detectable/exclusions` returned `200`, `content-type: application/json`, and `cache-control: public, max-age=3600`, so the route was registered in `NO_AUTHORIZATION_ROUTES` and no `401` response metadata was added.

## Changed Files

- `src/api/routes/games/detectable/exclusions.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/schemas/responses/DetectableGameExclusionsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/games-detectable-exclusions.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `worker-progress/games-detectable-exclusions-get.md`

## Behavior And Artifacts

- New source catalog entry: `GET_GAMES_DETECTABLE_EXCLUSIONS`, route `/games/detectable/exclusions`, source `src/api/routes/games/detectable/exclusions.ts`, response refs `APIErrorResponse` and `DetectableGameExclusionsResponse`.
- New schema: `DetectableGameExclusionsResponse` with required `executables` and `patterns`, both arrays of strings.
- Testing manifest entry: `api:http:GET:/games/detectable/exclusions/`, `authMode: public`, response statuses `200` and `502`.
- OpenAPI path: `GET /games/detectable/exclusions/`, public security, `200` response `DetectableGameExclusionsResponse`, `502` response `APIErrorResponse`.

## Missing-Route Movement

- Before regeneration on current base `a379f6576`: `missing = 795`, `spacebar = 385`
- After regeneration: `missing = 794`, `spacebar = 386`
- Assigned entry after regeneration: absent from `missing_entries[]`

## Verification

- `npm run build:src:tsgo` passed.
- `npm run build:test-fixtures` passed.
- Initial focused route test passed its runtime assertions and failed only the generated-artifact assertion before current-base artifact regeneration; after regeneration, the same focused compiled route test passed with 5/5 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed: `Spacebar is missing 794`, `Spacebar implements 386`.
- `npm run generate:schema` passed and wrote `749` schemas, including `DetectableGameExclusionsResponse`.
- `npm run generate:testing-manifest` passed: 491 entries.
- `node scripts/testing-manifest/verify.js` passed.
- `npm run generate:contract-tests` regenerated 466 contracts; `node scripts/testing-manifest/generate-contract-tests.js --check` passed.
- `npm run generate:suite-coverage` regenerated 15 suites; `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `npm run generate:openapi` passed and wrote 306 paths / 749 schemas; it still reports existing unrelated webhook route metadata warnings.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: 13/13 tests.
- Focused compiled route test passed: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/games-detectable-exclusions.test.js` with 5/5 tests passing.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json --exit-code` passed.
- Changed/untracked-file malformed warranty scan produced no output.

## Risks And Blockers

- No blockers.
- Runtime refresh depends on Discord's public endpoint. A cold upstream outage returns documented `502`; a warmed cache continues serving the last successful payload with `max-age=0` while refresh is failing.
- Adjacent `/games/detectable` remains unchanged and out of scope.

## Recommended Next Tasks

- No follow-up is required for this assigned path.
- A separate worker could review adjacent detectable game application routes for auth consistency if orchestrator assigns that scope.
