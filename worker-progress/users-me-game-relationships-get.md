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

# GET /users/@me/game-relationships

## Goal Evidence

- Worker `create_goal`: active objective `Implement the missing route path GET /users/@me/game-relationships for the Spacebar server API, with focused tests and regenerated route artifacts.`
- Worker `get_goal`: active with the same objective.
- Worker `update_goal(status: "complete")`: completed after implementation and verification.
- Audit follow-up goal evidence recorded in the worker session: explicit `401` repair goal was blocked by the prior completed goal; AGPL header repair used a second active goal and completed successfully.

## Scope

- Assigned path: `/users/@me/game-relationships`
- Missing methods found in the worker baseline: `GET`, `POST`
- Method implemented: `GET`
- Left out of scope by assignment: `POST /users/@me/game-relationships`, game relationship param mutation paths, and normal `/users/@me/relationships` routes.

## Evidence

- Source catalog before implementation had no `/users/@me/game-relationships` entry.
- `src/api/routes/**` had no game relationship route file or handler.
- Userdoccers `resources/relationships.mdx` lists "Get Game Relationships" for the current user.
- Existing Spacebar gateway READY data emits `game_relationships: []`, and Spacebar currently has no separate game relationship persistence or OAuth2 application-scoped game relationship data source.

## Behavior

- Auth mode: bearer auth through the normal API authentication boundary.
- Response: `200` JSON array using `GameRelationshipsResponse`.
- Data source: conservative empty collection until Spacebar has dedicated game relationship persistence and OAuth2 application scoping.
- Query parameters: none.
- Request body: none.
- Route-specific errors and side effects: none; no relationship mutation, gateway event, audit log, or persistence write.
- Auth error metadata: explicit `401` `APIErrorResponse`.

## Changed Files

- `src/api/routes/users/@me/game-relationships.ts`
- `src/schemas/responses/GameRelationshipsResponse.ts`
- `src/schemas/responses/index.ts`
- `scripts/testing-manifest/generate-contract-tests.js`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/routes/usersMeGameRelationshipsRoute.test.ts`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/users-me-game-relationships-get.md`

## Verification

- Worker verification before orchestrator port: source build, schema generation, test fixture build, focused compiled route test, source catalog import, missing-route regeneration, testing manifest verification, generated contract/suite checks and tests, OpenAPI generation, `git diff --check`, package manifest/lockfile guard, and malformed warranty-string scan all passed.
- Orchestrator current-base `npm run build:src:tsgo`: passed.
- Orchestrator current-base `npm run generate:schema`: passed.
- Orchestrator current-base `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Orchestrator current-base source route import: passed.
- Orchestrator current-base `npm run build --workspace @spacebar/missing-routes`: passed.
- Orchestrator current-base `npm run start --workspace @spacebar/missing-routes`: passed, `784 -> 783` missing and `396 -> 397` implemented.
- Orchestrator current-base `npm run generate:testing-manifest`: passed, 502 entries.
- Orchestrator current-base `node scripts/testing-manifest/verify.js`: passed.
- Orchestrator current-base generated contract check initially found stale output, then generation passed and the check passed with 477 contracts.
- Orchestrator current-base generated suite coverage check initially found stale output, then generation passed and the check passed with 15 suites.
- Orchestrator current-base `npm run generate:openapi`: passed, 315 paths and 791 schemas; webhook route middleware warnings were pre-existing.
- Orchestrator current-base `npm run build:test-fixtures`: passed.
- Orchestrator focused compiled route test: passed with 4 tests.
- Orchestrator generated contract and suite coverage tests: passed with 13 tests.
- Orchestrator `git diff --check`: passed.
- Orchestrator package manifest/lockfile guard: passed with no dependency manifest changes.
- Orchestrator malformed warranty-token scan over changed source/test/report/generated files: passed.

## Regeneration Results

- Worker baseline regeneration moved missing-route count from `847` to `846` and implemented-route count from `333` to `334`.
- Current-base regeneration after port moved missing-route count from `784` to `783` and implemented-route count from `396` to `397`.
- Remaining method for `/users/@me/game-relationships`: `POST`.
- Source catalog includes `GET /users/@me/game-relationships` with `APIErrorResponse` and `GameRelationshipsResponse`.
- OpenAPI includes `GET /users/@me/game-relationships/` with bearer security, `200` `GameRelationshipsResponse`, and `401` `APIErrorResponse`.
- Testing manifest includes `api:http:GET:/users/@me/game-relationships/`.

## Risks And Follow-Ups

- This is intentionally read-only and returns an empty collection because Spacebar lacks game relationship storage and OAuth2 application scoping for this resource.
- Implementing game relationship creation/removal should be a separate task that adds persistence, OAuth2 scope/application checks, and gateway events.
- If game relationships are later persisted, update this route to query by current user and, for OAuth2 requests, filter by request application.
