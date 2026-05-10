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

# content-inventory-users-param-outbox-get

## Summary

Implemented `GET /content-inventory/users/{param}/outbox` as `GET /content-inventory/users/{user_id}/outbox`.

The route is bearer-authenticated by the normal API middleware, validates that the path user exists, and returns a conservative empty outbox response because Spacebar has no local content-inventory outbox persistence or content metadata model to hydrate real entries.

## Assigned path

- Assigned route path: `/content-inventory/users/{param}/outbox`
- Source route: `/content-inventory/users/{user_id}/outbox`
- Missing methods found: `GET CONTENT_INVENTORY_OUTBOX`
- Methods implemented: `GET`

## Changed files

- `src/api/routes/content-inventory/users/#user_id/outbox.ts`
- `src/schemas/responses/ContentInventoryOutboxResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/contentInventoryUsersOutboxRoute.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `worker-progress/content-inventory-users-param-outbox-get.md`

## What changed

- Added route metadata with `200 ContentInventoryOutboxResponse`, `401 APIErrorResponse`, and `404 APIErrorResponse`.
- Added `ContentInventoryOutboxResponse` as an `unknown[]` schema for the conservative empty compatibility body.
- Added focused tests for bearer-auth classification, route metadata, existing path-user lookup, non-owner path access, empty response, and missing user 404 behavior.
- Regenerated source route catalog, missing-route report, schemas, testing manifest, generated HTTP contracts, suite coverage, and OpenAPI.

## Evidence gathered

- `packages/missing-routes/missing.json` contained the assigned `GET` entry named `CONTENT_INVENTORY_OUTBOX` with source route `/content-inventory/users/{user_id}/outbox`.
- The assigned route was absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `GET`, `HEAD`, and `OPTIONS` for `/content-inventory/users/{user_id}/outbox` as `CONTENT_INVENTORY_OUTBOX`; no query fields are present for the outbox route.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` and `docs.index.json` had no `content-inventory` match.
- Nearby Spacebar compatibility routes for inventory/entitlement/library surfaces return empty arrays when Spacebar lacks the backing store.
- The source path uses `{user_id}`, not `@me`; the implementation allows authenticated lookup of any existing path user and does not require path ownership.

## Missing-route count movement

- Before regeneration: `missing = 825`, `spacebar = 355`.
- After regeneration: `missing = 824`, `spacebar = 356`.
- Current-base orchestrator regeneration: `missing = 763`, `spacebar = 417`.
- The `/content-inventory/users/{param}/outbox` missing route and its `CONTENT_INVENTORY_OUTBOX` entry disappeared from `packages/missing-routes/missing.json`.

## Userdoccers/xHyroM references used

- xHyroM: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`, route entries around `CONTENT_INVENTORY_OUTBOX`.
- Userdoccers: no matching local catalog evidence for content inventory routes.
- Runtime coverage note: local coverage has `GET /content-inventory/users/@me?for_game_profile=false&feature=inbox`, but no captured outbox response body; it was used only as adjacent content-inventory context, not as an outbox shape source.

## Commands run

- `if [ -L node_modules ]; then unlink node_modules; fi`
- `if [ ! -d node_modules ]; then npm ci; fi`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/contentInventoryUsersOutboxRoute.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run generate:openapi`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `git diff --check`
- Malformed AGPL warranty scan from the worker brief.

All commands completed successfully.

## Current-base verification

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote 819 schemas.
- `npm run build:test-fixtures`: passed.
- Focused compiled route test:
  `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/contentInventoryUsersOutboxRoute.test.js`: passed, 4/4 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route import: passed and added `/content-inventory/users/{user_id}/outbox`.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed, `missing = 763`, `spacebar = 417`.
- `npm run generate:testing-manifest`: passed, 522 entries.
- `node scripts/testing-manifest/verify.js`: passed, 522 entries.
- Generated HTTP contracts: regenerated, then `--check` passed with 497 contracts.
- Generated suite coverage: `--check` passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13/13 tests.
- `npm run generate:openapi`: passed, 332 paths and 819 schemas. The webhook route-metadata warnings are pre-existing.

## Risks or blockers

- Spacebar still has no content-inventory outbox domain model. The route intentionally returns `[]` rather than fabricating inventory entries, game history, content metadata, or entitlements.
- Exact upstream outbox item shape remains unknown from local evidence. The schema is therefore intentionally `unknown[]` until source-backed payload evidence exists.

## Recommended next tasks

- Implement adjacent content-inventory routes only when separately assigned.
- If future xHyroM/Userdoccers/runtime evidence captures real outbox items, replace the `unknown[]` compatibility schema with a typed item schema and backing model.

## Goal status evidence

- `create_goal` objective: `implement the missing route path GET /content-inventory/users/{param}/outbox for the Spacebar server API.`
- `get_goal` before implementation reported status `active` with that objective.
- `get_goal` before this report reported status `active`, objective `implement the missing route path GET /content-inventory/users/{param}/outbox for the Spacebar server API.`
- Worker pane later reported goal complete with 643 seconds used.
