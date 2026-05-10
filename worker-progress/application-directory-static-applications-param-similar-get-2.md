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

# application-directory-static-applications-param-similar-get-2

## Goal Evidence

- `create_goal` succeeded before repository inspection.
- `get_goal` immediately after setup returned status `active`.
- Captured objective: Implement production-ready support for missing route path `GET /application-directory-static/applications/{param}/similar` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- Final `update_goal(status: "complete")`: succeeded; final goal status `complete`, token usage `202027`, time used `485 seconds`.

## Summary

Implemented `GET /application-directory-static/applications/{application_id}/similar` for the assigned missing route path only.

The route is public/no-auth, documents `guild_id`, `page`, and `locale`, returns `ApplicationDirectorySimilarApplicationsResponse`, and uses the existing application-directory application provider to confirm the target application exists before returning recommendations. Spacebar still has no source-backed App Directory catalog or ranking provider, so the default similar provider returns an empty recommendation payload for a source-backed target instead of fabricating related applications.

## Assigned Route

- Assigned path: `/application-directory-static/applications/{param}/similar`
- Missing methods found in `packages/missing-routes/missing.json`: `GET`
- Methods implemented: `GET`
- Expected route name: `GET_APPLICATION_DIRECTORY_STATIC_APPLICATIONS_APPLICATION_ID_SIMILAR`
- Source route: `/application-directory-static/applications/{application_id}/similar`
- Worker launch-base missing-route movement after regeneration: `733 -> 732`
- Current integration missing-route movement after orchestrator regeneration: `732 -> 731`
- Assigned entry remaining after regeneration: `0`
- Out-of-scope adjacent paths left alone: `/application-directory-static/applications/{param}`, `/application-directory/applications/{param}/embed`, `/application-directory-static/search`, `/application-directory-static/collections`, discovery search/store/profile routes.

## Evidence Gathered

- Current missing report listed exactly one owned entry: `GET /application-directory-static/applications/{param}/similar`, sourced from `userdoccers:resources/application-directory.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `/application-directory-static/applications/{application_id}/similar` entry before implementation.
- Userdoccers raw source checked: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/application-directory.mdx`.
- Userdoccers documents the similar endpoint as returning `applications`, `num_pages`, and `load_id`, with query fields `guild_id?`, `page?` max 1000 default 1, and `locale?`.
- Local Userdoccers catalog lists summary `Get Application Directory Similar Applications` for `GET /application-directory-static/applications/{application_id}/similar`.
- Local xHyroM catalog lists route name `APPLICATION_DIRECTORY_SIMILAR` for `GET`, `HEAD`, and `OPTIONS` on `/application-directory-static/applications/{application_id}/similar`.
- Stale prior branch `codex/current-missing-route-application-directory-static-applications-param-similar-get` was reviewed as read-only context; its tag-ranking logic was not copied because the assignment forbids fabricated recommendation logic.

## Behavior

- Auth mode: public/no-auth, matching other application-directory static reads; generated metadata omits `401`.
- Response schema: `ApplicationDirectorySimilarApplicationsResponse` object with `applications: ApplicationDirectoryApplication[]`, `num_pages: integer`, and `load_id: string`.
- Data source: provider seam in `createApplicationDirectoryStaticRouter`; default similar provider returns `[]`, `0`, and `application_directory_similar/empty`.
- Application lookup: the existing application-directory application provider must return a target application, otherwise the route returns `UNKNOWN_APPLICATION` with `404`.
- Query parsing: `guild_id` and `locale` use the existing first-string parser; invalid or out-of-range `page` falls back to documented default `1`.
- Cache behavior: `Cache-Control: public, max-age=3600, s-maxage=3600`, same as the adjacent static directory routes.
- Side effects: none; no persistence, gateway events, audit log, or write behavior.

## Changed Files

- `src/api/routes/application-directory-static.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/schemas/responses/ApplicationDirectorySimilarApplicationsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/application-directory-static-applications.test.ts`
- `test/routes/application-directory-static-search.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/application-directory-static-applications-param-similar-get-2.md`

## Artifact Evidence

- Source catalog now contains `GET_APPLICATION_DIRECTORY_STATIC_APPLICATIONS_APPLICATION_ID_SIMILAR`, source `src/api/routes/application-directory-static.ts`, response refs `APIErrorResponse` and `ApplicationDirectorySimilarApplicationsResponse`.
- `packages/missing-routes/missing.json` no longer contains the assigned route.
- Testing manifest now contains `api:http:GET:/application-directory-static/applications/:application_id/similar`, auth mode `public`, statuses `200` and `404`, and query metadata.
- OpenAPI now contains `/application-directory-static/applications/{application_id}/similar` with parameters `application_id`, `guild_id`, `page`, `locale`, responses `200` and `404`, and no security requirement.
- HTTP contracts now contain the new public route contract with the expected response metadata.

## Commands Run

- `npm run build:src:tsgo`: worker failed once with symlinked external `node_modules`, then passed after using local dependencies; orchestrator current-base run passed in the main checkout.
- `npm run generate:schema`: passed; orchestrator current-base run found 404 schemas and wrote 873 schema definitions.
- `npm run build:test-fixtures`: passed twice, including after focused test adjustment.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; orchestrator current-base run reported `Spacebar is missing 731`, `Spacebar implements 449`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed; orchestrator current-base run wrote 554 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale, then passed after `npm run generate:contract-tests`.
- `npm run generate:contract-tests`: passed; orchestrator current-base run wrote 529 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed.
- `npm run generate:openapi`: passed; orchestrator current-base run wrote 357 paths and 873 schemas, with existing warnings for unrelated webhook route metadata.
- `node --test dist-test/test/routes/application-directory-static-applications.test.js dist-test/test/routes/application-directory-static-search.test.js`: failed because module aliases were not preloaded.
- `node -r module-alias/register --test dist-test/test/routes/application-directory-static-applications.test.js dist-test/test/routes/application-directory-static-search.test.js`: passed, 15 tests.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no dependency manifest or lockfile diffs.
- Changed-file malformed warranty-string scan: passed.

## Risks And Next Tasks

- Userdoccers does not document explicit not-found semantics for the similar endpoint; this implementation follows the current static application detail route and returns `UNKNOWN_APPLICATION` when the target application is not source-backed.
- Default recommendations are intentionally empty because there is no source-backed application directory ranking data in Spacebar today.
- Recommended next task: add a real source-backed App Directory application/recommendation provider if a catalog becomes available.
- Adjacent route `/application-directory/applications/{param}/embed` remains missing and should be handled by its own worker.
