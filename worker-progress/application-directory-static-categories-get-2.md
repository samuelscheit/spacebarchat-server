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

# Worker Progress: application-directory-static-categories-get-2

## Summary

Implemented production-ready support for `GET /application-directory-static/categories`.

The route is public/no-auth, returns the Userdoccers documented category shape `{ id, name }`, honors source-backed localizations where present, omits `401` response metadata, and keeps application-directory categories separate from Spacebar guild discovery categories because the provider category IDs and names differ.

## Goal Evidence

- `create_goal`: created active goal for objective `Implement production-ready support for the missing route path /application-directory-static/categories on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal`: status `active`; same objective confirmed.
- Final `update_goal(status: "complete")`: status `complete`; time used `836` seconds; tokens used `402942`.

## Assigned Scope

- Assigned path: `/application-directory-static/categories`.
- Missing methods found: `GET`.
- Methods implemented: `GET`.
- xHyroM also catalogs `HEAD` and `OPTIONS`; the missing report only owned `GET`. `HEAD` is covered by Express GET handling and public auth inheritance.
- Out-of-scope adjacent paths not implemented: `/application-directory-static/search`, `/application-directory-static/collections`, `/application-directory-static/applications/{param}`, `/application-directory-static/applications/{param}/similar`, `/application-directory/applications/{param}/embed`, and `/applications/**`.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had exactly one owned entry: `GET /application-directory-static/categories`, route name `GET_APPLICATION_DIRECTORY_STATIC_CATEGORIES`, sources `userdoccers:resources/application-directory.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` initially had no `/application-directory-static/categories` route.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/application-directory.mdx`
  - Route header marks `GET /application-directory-static/categories` as unauthenticated.
  - Response is a list of application directory category objects with integer `id` and string `name`.
  - Query has optional `locale`.
- xHyroM source: `https://raw.githubusercontent.com/xhyrom/discord-datamining/master/data/client/routes.json`
  - `APPLICATION_DIRECTORY_CATEGORIES` maps to `/application-directory-static/categories`.
  - Allowed methods are `GET`, `HEAD`, and `OPTIONS`.
- Live public endpoint checks on 2026-05-10:
  - `GET https://discord.com/api/v10/application-directory-static/categories?locale=en-US` returned `200` without auth and the category IDs/names used as the default snapshot.
  - `GET ...?locale=de` returned `200` without auth and confirmed localized names.
  - Response headers included public cache semantics with one-hour max age.

## Behavior

- Auth mode: public/no-auth via `NO_AUTHORIZATION_ROUTES`.
- Response schema: `ApplicationDirectoryCategoriesResponse` array of `ApplicationDirectoryCategory`.
- Response body: fixed source-backed application-directory category snapshot in provider order:
  - `6 Games`
  - `4 Entertainment`
  - `8 Moderation and Tools`
  - `9 Social`
  - `10 Utilities`
- `locale` selects a source-backed localized name when present; unsupported locales fall back to the default en-US name.
- Cache header: `public, max-age=3600, s-maxage=3600`.
- Route-specific error semantics: no route-specific failure path because no upstream fetch or database dependency is used. Adjacent/unmatched paths remain normal 404s. No `401` metadata is declared because the route is public.

## Changed Files

- `src/api/routes/application-directory-static.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/schemas/responses/ApplicationDirectoryCategoriesResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/application-directory-static-categories.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/application-directory-static-categories-get-2.md`

## Verification

- Worker-base verification passed: source build, schema generation, test fixture build, focused compiled route tests 5/5, ARE build and source catalog import, missing-route regeneration, testing manifest verification, generated contract regeneration/checks, generated suite coverage checks, generated contract/suite tests 13/13, OpenAPI generation, `git diff --check`, package manifest/lockfile guard, and malformed warranty-string scan.
- Current-base verification passed on 2026-05-10 after porting onto `9bb88bc7a`: `npm run build:src:tsgo`, `npm run generate:schema`, `npm run build --workspace @spacebar/automatic-reverse-engineering`, `npm run build:test-fixtures`, source catalog import, `npm run build --workspace @spacebar/missing-routes`, `npm run start --workspace @spacebar/missing-routes`, `npm run generate:testing-manifest`, testing manifest verifier, generated contract regeneration/check, generated suite coverage check, `npm run generate:openapi`, rebuilt test fixtures, focused compiled route tests 5/5, generated contract/suite tests 13/13, `git diff --check`, package manifest/lockfile guard, and malformed warranty-string scan.
- Current-base generated artifact counts: testing manifest `541` entries, generated HTTP contracts `516`, OpenAPI `345` paths / `847` schemas.

## Missing-Route Movement

- Worker-base movement: `762 -> 761`; implemented count `418 -> 419`.
- Current-base movement after later merges: `745 -> 744`; implemented count `435 -> 436`.

## Risks And Notes

- The route uses a static source-backed category snapshot instead of a runtime Discord upstream fetch, avoiding an external dependency and preserving deterministic offline behavior.
- Localization coverage is intentionally conservative: only source-backed localized names are included; unsupported locales fall back to en-US.

## Recommended Next Tasks

- Implement adjacent application-directory static routes separately with their own data-source decisions and schemas.
- If Spacebar needs fully configurable application-directory categories later, add a dedicated operator-configurable category source instead of reusing guild discovery categories.
