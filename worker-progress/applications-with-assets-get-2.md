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

# GET /applications-with-assets

## Goal Evidence

- `create_goal` objective: `Implement production-ready GET support for /applications-with-assets on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Initial `get_goal` after setup: status `active`; objective matched the assigned worker objective.
- Final pre-handoff `get_goal`: status `active`; objective unchanged; tokens used `375141`; time used `713s`.

## Assigned Scope

- Assigned path: `/applications-with-assets`.
- Missing methods found before implementation: `GET`.
- Missing route name: `GET_APPLICATIONS_WITH_ASSETS`.
- Implemented methods: `GET /applications-with-assets/`.
- Adjacent application directory, store, activity, entitlement, SKU, OAuth2 asset, external asset, and asset mutation routes were not implemented.

## Source Evidence

- `packages/missing-routes/missing.json` contained exactly one missing entry for `GET /applications-with-assets`, sourced from `userdoccers:resources/application.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `/applications-with-assets` entry before integration.
- `src/api/routes/**` had no existing `/applications-with-assets` implementation before integration.
- Userdoccers source `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/application.mdx` documents the route as returning `{ applications, assets }`, with `with_team_applications` query support.
- Local xHyroM catalog records `GET`, `HEAD`, and `OPTIONS` for `/applications-with-assets`; worker scope was only `GET`.
- Spacebar has an `Application` entity and CDN app-asset path support but no durable Discord-style application asset catalog/entity, so the implementation returns real applications with an empty `assets` map rather than fabricated asset rows.

## Implementation Summary

- Added `src/api/routes/applications-with-assets.ts` as an authenticated route with explicit `401: { body: "APIErrorResponse" }` metadata.
- Added `ApplicationsWithAssetsResponse` and `ApplicationAssetResponse` schemas.
- Implemented `with_team_applications` parsing, owned application lookup, accepted team membership lookup, team application inclusion, and duplicate application ID de-duplication while preserving owned app precedence.
- Returned the narrow truthful compatibility shape `{ applications, assets: {} }` because asset metadata is not persisted.
- Added focused tests for route metadata, auth classification, owned response behavior, team inclusion behavior, de-duplication, and generated response schema shape.
- Added the route to scenario suite coverage and added a scenario assertion that the runtime response envelope includes the created application and empty assets map.

## Changed Files

- `src/api/routes/applications-with-assets.ts`
- `src/api/routes/applications-with-assets.test.ts`
- `src/schemas/responses/ApplicationsWithAssetsResponse.ts`
- `src/schemas/responses/ApplicationsWithAssetsResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `test/scenarios/applications-commands.test.ts`
- `testing/suite-coverage-policy.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/applications-with-assets-get-2.md`

## Regeneration Results

- Worker implementation moved the missing-route count from `776` to `775`; current-base integration moved it from `773` to `772`.
- `packages/missing-routes/missing.json` no longer contains an entry for `/applications-with-assets`.
- Source catalog now contains `GET /applications-with-assets` from `src/api/routes/applications-with-assets.ts`, with response refs `APIErrorResponse` and `ApplicationsWithAssetsResponse`.
- Testing manifest now has `513` entries.
- Generated HTTP contracts now have `488` contracts.
- OpenAPI now has `325` paths and `811` schemas; the only warnings were pre-existing webhook route-metadata warnings.

## Verification Commands

- `npm ci` passed, installing ignored local dependencies.
- `npm run build:src:tsgo` passed.
- `npm run generate:schema` passed.
- `npm run build:test-fixtures` passed, rerun after test and scenario changes.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/applications-with-assets.test.js dist-test/src/schemas/responses/ApplicationsWithAssetsResponse.test.js` passed: `5` tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed on the current base: `Spacebar is missing 772`, `Spacebar implements 408`, `Discord implements 1128`.
- `npm run generate:testing-manifest` passed.
- `node scripts/testing-manifest/verify.js` passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` initially found stale contract JSON; `npm run generate:contract-tests` passed; the rerun check passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` initially found the new route unassigned; after policy/scenario assignment, `npm run generate:suite-coverage` and the rerun check passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: `13` tests.
- `npm run generate:openapi` passed.
- `git diff --check` passed.

## Risks And Blockers

- Spacebar still lacks a persisted application asset catalog matching Discord's asset object map. Returning `assets: {}` avoids fabricating unknown asset metadata but means clients that need real application assets still need future backing storage.
- Team application inclusion relies on existing `Team.members` and `Application.team` relations; there is no broader application directory/store behavior in this route.
- xHyroM also lists HEAD/OPTIONS, but those methods were outside the assigned scope.
- License header scan for touched/new files is clean. A broader repo scan still finds unrelated pre-existing malformed warranty lines outside this route's scope, which were not changed to avoid boilerplate churn.

## Completion Audit

- Confirmed the assigned missing entry before editing.
- Confirmed source absence before editing.
- Implemented only `GET /applications-with-assets`.
- Added explicit authenticated `401` response metadata.
- Added focused route and schema tests.
- Regenerated schemas, OpenAPI, source catalog, missing-route report, testing manifest, contract tests, and suite coverage.
- Verified the missing entry was removed and the count dropped by one.
- Ran all required verification commands listed above.
- Left no intentionally unrelated source changes.

## Recommended Next Tasks

- Add a durable application asset catalog/entity before returning non-empty assets.
- Implement adjacent OAuth2/store/external asset mutation routes only through separate scoped assignments.
