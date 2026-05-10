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

# Worker Progress: application-directory-static-search-get-2

## Goal Evidence

- `create_goal`: created active goal `019e13b8-5277-7261-856f-6af6f990ba6c`.
- `get_goal`: status `active`.
- `update_goal`: status `complete`; final tool-reported time used `694` seconds.
- Objective: Implement production-ready support for the missing route path `GET /application-directory-static/search` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.

## Initial Evidence

- Assigned path: `/application-directory-static/search`.
- Missing methods found: `GET` only, from `GET_APPLICATION_DIRECTORY_STATIC_SEARCH` in `packages/missing-routes/missing.json`.
- Source references: `userdoccers:resources/application-directory.mdx`, `xhyrom:data/client/routes.json`.
- Confirmed absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`.
- Confirmed absent from `src/api/routes/**`; existing nearby static routes only cover `/application-directory-static/categories` and `/application-directory-static/collections`.
- Starting missing-route count: `741` missing entries.

## Handoff Report

### Summary

Implemented `GET /application-directory-static/search` for the static Application Directory surface. The route is public/no-auth, cacheable with the existing static App Directory cache policy, typed with `ApplicationDirectorySearchResponse`, and exposes a provider seam for future search persistence/indexing. Because this codebase has no durable App Directory search index, the default production behavior returns a conservative empty search payload and does not fabricate application records.

### Assigned Scope

- Assigned path: `/application-directory-static/search`.
- Missing methods found: `GET`.
- Methods implemented: `GET`.
- Out-of-scope adjacent paths: `/application-directory-static/applications/{application_id}`, `/application-directory-static/applications/{application_id}/similar`, `/application-directory-static/categories`, `/application-directory-static/collections`, non-static `/application-directory/**`, store, recommendations, and general application search routes.

### Evidence Gathered

- `packages/missing-routes/missing.json`: owned entry was `GET_APPLICATION_DIRECTORY_STATIC_SEARCH`; after regeneration the assigned entry is gone.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`: documents `GET /application-directory-static/search` as `Search Applications Directory`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`: xHyroM catalog includes `/application-directory-static/search` under `APPLICATION_DIRECTORY_SEARCH`.
- Userdoccers page `https://docs.discord.food/resources/application-directory`: marks Application Directory endpoints unauthenticated and lists search query fields plus response fields `results`, `num_pages`, `counts_by_category`, `type`, and `load_id`.
- Existing Spacebar patterns: `/application-directory-static/categories` and `/application-directory-static/collections` are public, static, cacheable endpoints with no bearer `401` route metadata.

### Behavior

- Auth mode: public/no-auth; no explicit `401` response metadata was added.
- Query handling: parses documented optional fields for query text, guild id, page, page size, category id, locale, install-command count threshold, exclusion booleans, and source surface. Out-of-range documented numeric filters and unsupported boolean encodings are ignored rather than turned into fabricated results.
- Response schema: `ApplicationDirectorySearchResponse` with `results: ApplicationDirectorySearchResult[]`, `num_pages`, `counts_by_category`, `type`, and `load_id`.
- Default data source: empty in-memory provider result, with `results: []`, `num_pages: 0`, `counts_by_category: {}`, `type: APPLICATION`, and stable load id `application_directory_search/empty`.
- Cache behavior: `Cache-Control: public, max-age=3600, s-maxage=3600`, matching nearby static App Directory routes.
- Error semantics: no route-specific errors; unsupported/invalid filters yield the empty compatible payload.

### Changed Files

- `src/api/routes/application-directory-static.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/schemas/responses/ApplicationDirectorySearchResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/application-directory-static-search.test.ts`
- `test/routes/application-directory-static-categories.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/application-directory-static-search-get-2.md`

### Verification

- Orchestrator ported the scoped source, test, schema, no-auth, and report changes onto current master after `5a3605613`; generated artifacts were regenerated on the current base instead of reusing older worker artifacts.
- `npm run build:src:tsgo`: passed after replacing the temporary dependency symlink with an ignored local `node_modules` copy. Initial symlink attempt failed on a portable inferred-type path outside this worktree.
- Current-base `npm run build:src:tsgo`: passed.
- Current-base `npm run generate:schema`: passed, wrote `868` schemas.
- Current-base `npm run build:test-fixtures`: passed.
- Focused route/schema tests: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/application-directory-static-search.test.js dist-test/test/routes/application-directory-static-categories.test.js dist-test/test/routes/application-directory-static-collections.test.js` passed, 15/15.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- Current-base `npm run start --workspace @spacebar/missing-routes`: passed; missing count moved from `737` to `736`, implemented count moved from `443` to `444`.
- Current-base `npm run generate:testing-manifest`: passed, wrote `549` entries.
- `node scripts/testing-manifest/verify.js`: passed, verified `549` entries.
- Current-base `npm run generate:contract-tests`: passed, wrote `524` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13/13.
- Current-base `npm run generate:openapi`: passed with pre-existing warnings for webhook routes missing route metadata; wrote `353` paths and `868` schemas.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no dependency manifest changes.
- Malformed warranty-string scan: passed.

### Generated Evidence

- Source catalog now has `GET /application-directory-static/search` with response schema `ApplicationDirectorySearchResponse` and source `src/api/routes/application-directory-static.ts`.
- Testing manifest now has `api:http:GET:/application-directory-static/search` with `authMode: public`.
- OpenAPI now has `/application-directory-static/search` `GET` response `200 -> ApplicationDirectorySearchResponse` and no `401` response.
- Generated HTTP contracts now include the search route public auth-boundary, schema-validation, and response-shape checks.

### Risks And Next Tasks

- Risk: default results are intentionally empty until Spacebar has a durable App Directory search index or imported static dataset. This avoids synthetic or misleading directory entries.
- Recommended next task: implement a real App Directory application index/provider and wire it behind `ApplicationDirectorySearchProvider`, then add result filtering/pagination tests against stored applications.
- Recommended adjacent tasks: implement the remaining static application detail and similar-application endpoints separately; they are not required for this route.
