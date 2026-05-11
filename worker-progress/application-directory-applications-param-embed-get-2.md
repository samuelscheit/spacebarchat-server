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

# Application Directory Application Embed

## Scope

- Assigned route: `GET /application-directory/applications/{application_id}/embed`.
- Missing-report form: `GET /application-directory/applications/{param}/embed`.
- Methods found and implemented for this exact path: `GET` only.
- Out of scope and not implemented: application-directory static routes, application command index routes, app recommendations, embedded activity config routes, and adjacent application directory paths.

## Goal And Source Evidence

- Worker `create_goal`: created an active goal for this exact route assignment.
- Worker `get_goal`: returned active status with the same objective.
- Worker `update_goal`: final handoff reported completion after 197 seconds.
- `packages/missing-routes/missing.json` listed one owned `GET` entry for this path before the current-base port.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists route `/application-directory/applications/{application_id}/embed`, route name `GET_APPLICATION_DIRECTORY_APPLICATIONS_APPLICATION_ID_EMBED`, and source `userdoccers:resources/application-directory.mdx`.
- Worker checked Userdoccers application-directory docs and reported the endpoint returns a partial application object with documented `with_localizations` query support.
- Worker reported an unauthenticated live probe returned `401`; the accepted route remains bearer-authenticated and is not added to no-auth route lists.

## Behavior

- Auth mode: bearer-authenticated route with explicit `401: APIErrorResponse` metadata.
- Query: accepts `with_localizations=true|false`; unsupported values are ignored. `locale` and `nocache` are intentionally not exposed on this non-static embed route.
- Response: `ApplicationDirectoryApplication`.
- Errors: missing or unknown applications return `UNKNOWN_APPLICATION`; missing bearer auth returns the existing authentication middleware `401` shape.
- Data source: provider-backed `ApplicationDirectoryApplication`. The default provider delegates to the existing application-directory static application lookup, which currently returns `undefined` because Spacebar has no durable local App Directory application catalog.
- Cache behavior: no static `Cache-Control` header is set for this authenticated non-static route.

## Accepted Current-Base Changes

- `src/api/routes/application-directory/applications/#application_id.ts`
- `test/routes/application-directory-application-embed.test.ts`
- `test/routes/application-directory-static-applications.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `assets/openapi.json`
- `worker-progress/application-directory-applications-param-embed-get-2.md`

## Excluded Worker Change

- The worker's `src/api/util/handlers/ChannelMessageCreateRoute.ts` type annotation was not ported because current-base `npm run build:src:tsgo` passed without it.

## Current-Base Verification

- `npm run build:src:tsgo`: passed without the worker's old-base message handler annotation.
- `npm run generate:schema`: passed; wrote 937 schemas.
- `npm run build:test-fixtures`: passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed and reported `Spacebar is missing 704`, `Spacebar implements 476`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed and wrote 581 entries.
- `node scripts/testing-manifest/verify.js`: passed with 581 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially reported stale generated contracts, then passed after `npm run generate:contract-tests` wrote 556 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed 13/13.
- `npm run generate:openapi`: passed and reported 382 paths, 937 schemas, and 3 pre-existing routes missing route middleware.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/application-directory-application-embed.test.js dist-test/test/routes/application-directory-static-applications.test.js`: passed 14/14.
- `npx prettier --write src/api/routes/application-directory/applications/#application_id.ts test/routes/application-directory-application-embed.test.ts test/routes/application-directory-static-applications.test.ts`: passed.
- `npx eslint --concurrency 4 src/api/routes/application-directory/applications/#application_id.ts test/routes/application-directory-application-embed.test.ts test/routes/application-directory-static-applications.test.ts`: passed.

## Missing-Route Movement

- Before current-base port: `missing = 705`, `spacebar = 475`, `discord = 1128`.
- After current-base regeneration: `missing = 704`, `spacebar = 476`, `discord = 1128`.
- Owned entry still missing after regeneration: none.

## Risks And Follow-Up

- The route currently cannot return real directory embed data unless a provider supplies source-backed application-directory records. This matches the existing static application-directory implementation and avoids fabricating application data.
- xHyroM lists adjacent `HEAD` and `OPTIONS`, but the current missing report owned only `GET`; Express naturally serves `HEAD` for the `GET` handler.
