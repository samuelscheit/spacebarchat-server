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

# applications-non-games-detectable-get-2

## Goal

- Status: complete; worker pane reported goal complete with 643 seconds used.
- Objective: Implement production-ready support for the missing route path `/applications/non-games/detectable` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.

## Progress

- Initialized worker progress file.
- Read worker brief.
- Confirmed missing report contains one owned entry: `GET /applications/non-games/detectable`.
- Confirmed exact route was absent from `routes.source.catalog.json` and `src/api/routes/**` before implementation.
- Userdoccers `pages/resources/game.mdx` marks the route as unauthenticated and returning detectable application objects for non-games.
- Added route implementation, no-auth registration, focused tests, testing policy classification, regenerated route catalogs, missing-route report, testing manifest, generated contract/suite artifacts, and OpenAPI.

## Summary

Implemented `GET /applications/non-games/detectable` as a public compatibility route backed by Discord's upstream public endpoint:

- Upstream URL: `https://discord.com/api/v10/applications/non-games/detectable`
- Response metadata: `200 ApplicationDetectableResponse`, `502 APIErrorResponse`
- Auth mode: public/unauthenticated
- Cache behavior: 6 hour public immutable cache; stale cached data is served if refresh fails; a cold upstream failure returns `502`
- Conservative data behavior: only array payloads are accepted; malformed or unavailable upstream data is treated as upstream failure rather than fabricated application records

## Missing Route Movement

- Before regeneration: `missing: 772`, `spacebar: 408`
- After regeneration: `missing: 771`, `spacebar: 409`
- Owned entry removed from `packages/missing-routes/missing.json`: `GET /applications/non-games/detectable`

## Changed Files

- `src/api/routes/applications/non-games/detectable.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `test/routes/applications-non-games-detectable.test.ts`
- `testing/coverage-policy.json`
- `testing/suite-coverage-policy.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/applications-non-games-detectable-get-2.md`

## Evidence

- `packages/missing-routes/missing.json` initially had one owned entry for `GET /applications/non-games/detectable`.
- `rg 'applications/non-games/detectable|/applications/non-games/detectable' packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json src/api/routes` returned no matches before implementation.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/game.mdx`
  - Route header: `GET /applications/non-games/detectable` with `unauthenticated`
  - Description: returns detectable application objects representing non-games detectable for rich presence
- Regenerated source catalog entry:
  - `route`: `/applications/non-games/detectable`
  - `route_name`: `GET_APPLICATIONS_NON_GAMES_DETECTABLE`
  - `response_schema_refs`: `APIErrorResponse`, `ApplicationDetectableResponse`
- Regenerated testing manifest entry:
  - `id`: `api:http:GET:/applications/non-games/detectable/`
  - `authMode`: `public`
  - `coverage.policyId`: `api-public-applications-non-games-detectable`
- Regenerated OpenAPI entry has no `401` response and no security requirement.

## Verification

- `npm ci` (needed because this worktree had no installed `node_modules`)
- `npm run build:src:tsgo` (first attempt failed before install: missing `@types/node`; rerun passed after `npm ci`)
- `npm run generate:schema`
- `npm run build:test-fixtures`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` (stale before regeneration, passed after `npm run generate:contract-tests`)
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-suite-coverage.js --check` (stale before regeneration, passed after `npm run generate:suite-coverage`)
- `npm run generate:suite-coverage`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run generate:openapi`
- `npm run build:test-fixtures` (rerun after final artifact regeneration)
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/applications-non-games-detectable.test.js`
- `git diff --check`
- Changed-file malformed warranty-token scan returned no matches.

## Current-Base Orchestrator Verification

- Ported scoped source, test, policy, and report changes onto
  `4fbe59e81 Implement content inventory outbox route`; regenerated generated
  artifacts on that base instead of copying worker artifacts.
- `npm run build:src:tsgo`: passed.
- `npm run build:test-fixtures`: passed.
- Focused compiled route test:
  `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/applications-non-games-detectable.test.js`:
  passed, 6/6 tests, after current-base artifact regeneration.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route import: passed and added
  `/applications/non-games/detectable`.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed,
  `missing: 762`, `spacebar: 418`.
- `npm run generate:testing-manifest`: passed, 523 entries.
- `node scripts/testing-manifest/verify.js`: passed, 523 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: stale
  before regeneration.
- `npm run generate:contract-tests`: passed, 498 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed,
  498 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`:
  passed, 13/13 tests.
- `npm run generate:openapi`: passed, 333 paths and 819 schemas. The webhook
  route-metadata warnings are pre-existing.

## Risks And Notes

- Runtime data depends on Discord's public upstream endpoint because Spacebar does not currently maintain a distinct local non-game detectable catalog.
- The route intentionally does not fabricate fallback non-game records; cold upstream failure returns `502`.
- No xHyroM source was needed for this exact path; the missing entry referenced Userdoccers only.

## Recommended Next Tasks

- Consider extracting a shared detectable-application proxy helper for `/applications/detectable`, `/games/detectable`, and this route if future workers touch those adjacent endpoints.
- Consider adding a typed detectable application response schema beyond the current `unknown[]` alias if broader schema work is in scope.
