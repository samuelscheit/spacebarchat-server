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

# GET /stage-instances/extra

## Summary

Implemented only `GET /stage-instances/extra`.

The route is bearer-authenticated and returns a narrow local representation of the authenticated user's visible persisted stage instances as `StageInstancesExtraResponse`, an array of `StageInstanceResponse`. Spacebar does not currently persist Discord-only extra stage discovery, participant, voice-state, scheduled-event, or discoverable-guild metadata, so the implementation does not fabricate those fields.

## Source Evidence

- `packages/missing-routes/missing.json` initially contained `GET /stage-instances/extra` with route name `STAGE_INSTANCES_EXTRA`, sourced from `xhyrom:data/client/routes.json`.
- The source route catalog had no local `GET /stage-instances/extra` before this change.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` has `/stage-instances/extra` entries for `DELETE`, `GET`, `HEAD`, `OPTIONS`, and `PATCH` under route name `STAGE_INSTANCES_EXTRA`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` has no `/stage-instances/extra` entry; it only lists `POST /stage-instances` and channel-scoped `GET`, `PATCH`, and `DELETE /stage-instances/{channel_id}` from `userdoccers:resources/stage-instance.mdx`.

## Behavior

- `GET /stage-instances/extra/` requires bearer authentication through the existing API auth middleware.
- The handler lists guild memberships for the requester, loads persisted stage instances for those guilds, filters each stage instance by `VIEW_CHANNEL`, and serializes each result with the existing `StageInstanceResponse` shape.
- Users with no guild memberships receive `[]`.
- Expected permission misses during visibility checks are treated as not visible; unexpected permission errors still propagate.
- No `DELETE` or `PATCH` handler was added for `/stage-instances/extra`.

## Changed Files

- `src/api/routes/stage-instances/extra.ts`
- `src/api/routes/stage-instances/extra.test.ts`
- `src/api/util/handlers/StageInstance.ts`
- `src/api/util/handlers/StageInstance.test.ts`
- `src/schemas/responses/StageInstanceResponse.ts`
- `src/schemas/responses/StageInstanceResponse.test.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/stage-instances-extra-get.md`

## Generated Evidence

- `assets/schemas.json` now contains `StageInstancesExtraResponse` as an array of `StageInstanceResponse`.
- `assets/openapi.json` now contains `GET /stage-instances/extra/` with bearer security and `200 StageInstancesExtraResponse`, `401 APIErrorResponse`.
- Source catalog now contains `GET /stage-instances/extra` from `src/api/routes/stage-instances/extra.ts` with response schemas `APIErrorResponse` and `StageInstancesExtraResponse`.
- Testing manifest now contains `api:http:GET:/stage-instances/extra/`, auth mode `bearer`, response statuses `[200, 401]`, and source file `src/api/routes/stage-instances/extra.ts`.
- Generated HTTP contract matrix now contains the new route contract.

## Missing-Route Movement

- Before regeneration: `missing` 589, `spacebar` 591, `discord` 1128.
- After regeneration: `missing` 588, `spacebar` 592, `discord` 1128.
- `GET /stage-instances/extra` was removed from `missing_entries`.
- `DELETE /stage-instances/extra` and `PATCH /stage-instances/extra` remain in `missing_entries` and were intentionally untouched.

## Adjacent Routes Untouched

- `DELETE /stage-instances/extra`
- `PATCH /stage-instances/extra`
- Channel-scoped stage-instance create, get, patch, and delete routes except for shared handler tests.
- Guild scheduled-event routes.
- Voice-state, discovery, discoverable-guild, and participant-related routes.

## Verification

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`: passed; no package or lockfile diffs.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`: passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`: passed; wrote 1119 schemas.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`: passed; wrote 483 paths and 1119 schemas. Existing warnings for webhook routes without `route()` metadata remained.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`: passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`: passed; reported `Spacebar is missing 588`, `Spacebar implements 592`, `Discord implements 1128`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`: passed; wrote 697 entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`: passed; wrote 672 contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`: passed; wrote 15 suites.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`: passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/handlers/StageInstance.test.js dist-test/src/api/routes/stage-instances/extra.test.js dist-test/src/schemas/responses/StageInstanceResponse.test.js`: passed, 20 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`: passed, 697 entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`: passed, 672 contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js`: passed, 9 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/suite-coverage.test.js`: passed, 4 tests.
- `git diff --check`: passed.
- Malformed warranty typo scan: passed for changed source/test files.

## Verification Limitation

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/generated/http-auth-runtime-contracts.test.js` failed in an unrelated public response-schema check: `api:http:GET:/discovery/search` returned `500` instead of `200`.
- The same run also printed existing route registration warnings for analytics `query` helper files that do not export routers. This was not caused by `GET /stage-instances/extra`.

## Risks Or Blockers

- The xHyroM source only proves route existence and route name, not a response payload contract.
- Because Userdoccers does not document `/stage-instances/extra`, the returned shape is intentionally a local, stable subset of persisted `StageInstanceResponse` records rather than Discord's likely richer private client payload.
- The route does a per-stage-instance `VIEW_CHANNEL` permission check. This is conservative and correct for visibility, but it is not optimized for very large numbers of active stage instances.
- No route-specific blocker remains. The only observed failing generated runtime contract is the unrelated `GET /discovery/search` public response-schema failure noted above.

## Recommended Next Tasks

- Implement or explicitly triage the remaining `DELETE /stage-instances/extra` and `PATCH /stage-instances/extra` missing entries separately; they were out of scope for this worker.
- If future source evidence documents the private extra payload shape, add a richer schema and persistence-backed fields without fabricating unsupported Discord-only state.
- Investigate the unrelated generated runtime contract failure for `GET /discovery/search`.

## Reconciliation Notes

- This worktree has local dependencies installed via `npm ci`.
- No package or lockfile changed.
- No reconciliation is currently needed: the assigned branch HEAD is `7bf94e40b5fe683326486dfef6a0586d2cb0e312`, matching the stated current integration base.

## Integration Acceptance

- Accepted on current integration base `d0b1a9c7e6750fa21024e2023d786f206b1f4621`.
- Ported only the worker-owned route, handler, schema, focused tests, `tsconfig.test.json` entries, and this progress report; regenerated shared artifacts on the current base.
- Current-base missing-route movement: `missing` 583 -> 582, `spacebar` 597 -> 598, `discord` 1128 unchanged.
- `GET /stage-instances/extra` is removed from `missing_entries`; `DELETE /stage-instances/extra` and `PATCH /stage-instances/extra` remain missing and out of scope.
- Verification passed on current base:
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/handlers/StageInstance.test.js dist-test/src/api/routes/stage-instances/extra.test.js dist-test/src/schemas/responses/StageInstanceResponse.test.js`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/suite-coverage.test.js`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run lint`
  - `git diff --check`
  - package and lockfile guard
- Full `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` failed only on the known unrelated runtime contract `api:http:GET:/discovery/search` returning `500 !== 200`; existing analytics `query` route-registration warnings also appeared.
