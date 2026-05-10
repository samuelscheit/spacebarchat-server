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

# application-directory-static-applications-param-get-2

## Goal Evidence

- Worker `create_goal`: active objective for production-ready support of
  `GET /application-directory-static/applications/{param}`.
- Worker `get_goal`: status `active`; same objective confirmed.
- Worker `update_goal`: status `complete`; final tool result reported
  `tokensUsed: 277906` and `timeUsedSeconds: 671`.

## Assignment

- Worker id: `application-directory-static-applications-param-get-2`
- Assigned path: `/application-directory-static/applications/{param}`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Expected missing entry:
  `GET_APPLICATION_DIRECTORY_STATIC_APPLICATIONS_APPLICATION_ID`
- Out-of-scope adjacent paths:
  `/application-directory-static/applications/{param}/similar`,
  `/application-directory-static/search`, `/application-directory-static/categories`,
  `/application-directory-static/collections`, non-static
  `/application-directory/**`, storefront, recommendations, and general
  application routes.

## Evidence

- Current-base `packages/missing-routes/missing.json` had one owned entry for
  `GET /application-directory-static/applications/{param}` before the merge.
- Current-base source catalog had no implementation for
  `/application-directory-static/applications/{application_id}` before this
  route was added.
- Local Userdoccers catalog lists
  `GET /application-directory-static/applications/{application_id}` with
  summary `Get Application Directory Application`.
- Local xHyroM catalog lists `APPLICATION_DIRECTORY_APPLICATION` for `GET`,
  `HEAD`, and `OPTIONS`; the owned missing-route report required only `GET`.
- Userdoccers documents a partial application object response and the query
  fields `locale`, `nocache`, and `with_localizations`.
- Existing static app-directory category/search/collection routes are public,
  cacheable, and avoid fabricated data when Spacebar has no source-backed
  catalog.

## Behavior

- Auth mode: public/no bearer. `NO_AUTHORIZATION_ROUTES` has an exact dynamic
  matcher for `GET` and inherited `HEAD`; `/similar` remains protected/missing.
- Query parsing: `locale`, `nocache`, and `with_localizations` are parsed and
  passed to the provider; invalid or empty values are ignored.
- Response metadata: `200` returns `ApplicationDirectoryApplication`; `404`
  returns `APIErrorResponse`; no `401` metadata is emitted for the public route.
- Data source: injectable `ApplicationDirectoryApplicationProvider`, supporting
  sync or async lookups. The default provider returns unknown because Spacebar
  currently has no durable source-backed static App Directory application
  catalog.
- Error semantics: missing or unknown application IDs throw
  `DiscordApiErrors.UNKNOWN_APPLICATION`.
- Cache behavior: successful responses use
  `APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL`.

## Changed Files

- `src/api/routes/application-directory-static.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `test/routes/application-directory-static-applications.test.ts`
- `test/routes/application-directory-static-categories.test.ts`
- `test/routes/application-directory-static-search.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Verification

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; no schema type changes were required.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` -
  passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` -
  passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; current-base
  report moved `734 -> 733` missing and `446 -> 447` implemented.
- `npm run generate:testing-manifest` - passed; wrote 552 entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` -
  initially reported stale generated contract JSON; `npm run
generate:contract-tests` passed with 527 contracts, and the rerun check
  passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; specification contains 356 paths and
  871 schemas and still reports the pre-existing webhook route metadata
  warnings.
- `npm run build:test-fixtures` - passed.
- Focused compiled static directory tests - passed, 20 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` -
  passed, 13 tests.

## Missing-Route Count Movement

- Before current-base regeneration: `missing = 734`, `spacebar = 446`,
  `discord = 1128`.
- After current-base regeneration: `missing = 733`, `spacebar = 447`,
  `discord = 1128`.
- Exact owned entry after regeneration: no
  `GET /application-directory-static/applications/{param}` entry remains in
  `missing_entries[]`.
- Adjacent `/application-directory-static/applications/{param}/similar` remains
  missing and out of scope.

## Risks And Follow-Ups

- Spacebar still lacks a durable source-backed static App Directory application
  dataset. The route is provider-backed and conservative by default rather than
  deriving directory records from general application rows.
- Implement `/application-directory-static/applications/{param}/similar`
  separately.
