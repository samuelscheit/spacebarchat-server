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

# activities-statistics-applications-param-get-2 Progress

## Goal Evidence

- Worker `create_goal`: active objective for production-ready support of
  `/activities/statistics/applications/{param}`.
- Worker `get_goal`: status `active`; same objective confirmed.
- Worker `update_goal`: status `complete`; final tool usage reported 775
  seconds.

## Assignment

- Worker id: `activities-statistics-applications-param-get-2`
- Assigned path: `/activities/statistics/applications/{param}`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Expected missing entry:
  `GET_ACTIVITIES_STATISTICS_APPLICATIONS_APPLICATION_ID`
- Out-of-scope adjacent paths: `/activities`, `/activities/shelf`,
  `/activities/{param}/test-mode`,
  `/activities/{application_id}/instances/{channel_id}`, `/applications/**`,
  and `/users/@me/activities/statistics/applications`.

## Evidence

- Current-base `packages/missing-routes/missing.json` had one owned entry for
  `GET /activities/statistics/applications/{param}` before the merge.
- Current-base source catalog had no
  `/activities/statistics/applications/{application_id}` entry before this
  route was added.
- Userdoccers catalog maps `GET /activities/statistics/applications/{application_id}`
  to `userdoccers:resources/presence.mdx` with summary
  `Get Application Activity Statistics`.
- xHyroM catalog maps `APPLICATION_ACTIVITY_STATISTICS` to the same source
  route; `HEAD` and `OPTIONS` are not owned by the current missing-route report.
- Userdoccers describes application activity statistics as rows with
  `user_id`, `last_played_at`, and `total_duration` for friends and affine
  users, with OAuth2 support using the `activities.read` scope.

## Behavior

- Auth mode: bearer-authenticated. The route is not in
  `NO_AUTHORIZATION_ROUTES`, focused tests assert the auth boundary, and route
  metadata declares `401: { body: "APIErrorResponse" }`.
- Response schema: `ApplicationActivityStatisticsResponse`, an array of
  `{ user_id, last_played_at, total_duration }`.
- Data source: conservative empty response because Spacebar does not currently
  persist friend or affine-user game playtime statistics.
- Error semantics: missing/invalid bearer auth is handled by the existing API
  authentication middleware as a 401 error response. Empty statistics state is
  a successful `200 []`, not fabricated activity data.

## Changed Files

- `src/api/routes/activities/statistics/applications/#application_id.ts`
- `src/schemas/responses/ApplicationActivityStatisticsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/application-activity-statistics-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Verification

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; wrote 871 schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` -
  passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` -
  passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; current-base
  report moved `735 -> 734` missing and `445 -> 446` implemented.
- `npm run generate:testing-manifest` - passed; wrote 551 entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` -
  initially reported stale generated contract JSON; `npm run
generate:contract-tests` passed with 526 contracts, and the rerun check
  passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; specification contains 355 paths and
  871 schemas and still reports the pre-existing webhook route metadata
  warnings.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/application-activity-statistics-route.test.js` -
  passed, 3 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` -
  passed, 13 tests.

## Missing-Route Count Movement

- Before current-base regeneration: `missing = 735`, `spacebar = 445`,
  `discord = 1128`.
- After current-base regeneration: `missing = 734`, `spacebar = 446`,
  `discord = 1128`.
- Exact owned entry after regeneration: no
  `GET /activities/statistics/applications/{param}` entry remains in
  `missing_entries[]`.

## Risks And Follow-Ups

- Spacebar still has no durable activity statistics source. The route
  intentionally returns `[]` until real friend or affine-user application
  activity statistics exist.
- xHyroM catalogs `HEAD` and `OPTIONS` for the source route, but the missing
  report owned only `GET`; those methods remain out of scope.
