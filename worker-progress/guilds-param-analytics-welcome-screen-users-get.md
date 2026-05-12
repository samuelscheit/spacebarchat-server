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

# guilds-param-analytics-welcome-screen-users-get

## Summary

- Assigned route: `GET /guilds/{param}/analytics/welcome-screen/users`.
- Implemented source route: `GET /guilds/{guild_id}/analytics/welcome-screen/users`.
- Route name: `GET_GUILDS_GUILD_ID_ANALYTICS_WELCOME_SCREEN_USERS`.
- Behavior: validates the common guild analytics `start`, `end`, and `interval` query parameters, preserves `VIEW_GUILD_INSIGHTS` route metadata, verifies the guild exists, and returns an empty `GuildWelcomeScreenUsersResponse`.
- Local data stance: Spacebar does not persist Discord's privacy-thresholded welcome-screen user view aggregates, so the route does not fabricate analytics buckets.

## Changed Files

- `src/api/routes/guilds/#guild_id/analytics/welcome-screen/users.ts`
- `src/schemas/responses/GuildWelcomeScreenUsersResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-param-analytics-welcome-screen-users-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-analytics-welcome-screen-users-get.md`

## Evidence Sources

- `packages/missing-routes/missing.json` initially contained exactly one matching missing entry for `GET /guilds/{param}/analytics/welcome-screen/users`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no `GET /guilds/{guild_id}/analytics/welcome-screen/users` entry.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` maps the route to `userdoccers:resources/guild-analytics.mdx` with summary `Get Guild Welcome Screen Users`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` has no matching welcome-screen users route.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild-analytics.mdx`.
- Userdoccers documents welcome screen analytics as based on members who visited in the last 28 days, excludes users opted out of analytics tracking, and applies privacy thresholds. It documents `GET /guilds/{guild_id}/analytics/welcome-screen/users` as accepting the common `start`, `end`, and `interval` query parameters and returning buckets with `day_pt` and `users_viewed_welcome_screen`.
- Nearby implementation references: `src/api/routes/guilds/#guild_id/analytics/welcome-screen/funnel.ts`, `src/api/routes/guilds/#guild_id/analytics/engagement/query.ts`, and adjacent guild analytics response schemas.

## Missing-Route Movement

- Before regeneration on this base: `missing = 540`, `spacebar = 640`, `discord = 1128`.
- After regeneration: `missing = 539`, `spacebar = 641`, `discord = 1128`.
- The exact `GET /guilds/{param}/analytics/welcome-screen/users` missing entry is no longer present.
- Source catalog now contains `GET /guilds/{guild_id}/analytics/welcome-screen/users` with response refs `APIErrorResponse` and `GuildWelcomeScreenUsersResponse`.

## Scope Boundaries

- Implemented only `GET /guilds/{param}/analytics/welcome-screen/users`.
- Left adjacent routes untouched:
    - `/guilds/{param}/analytics/welcome-screen/funnel`
    - `/guilds/{param}/analytics/growth-activation/overview`
    - `/guilds/{param}/analytics/growth-activation/retention`
    - all analytics query helper routes
    - all welcome-screen mutation and non-analytics routes

## Commands Run

- `sed -n '1,240p' /Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`
- Evidence and source searches with `rg`, `find`, `sed`, and `node`.
- Userdoccers raw GitHub lookup for `pages/resources/guild-analytics.mdx`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx prettier --write 'src/api/routes/guilds/#guild_id/analytics/welcome-screen/users.ts' src/schemas/responses/GuildWelcomeScreenUsersResponse.ts src/schemas/responses/index.ts test/routes/guilds-param-analytics-welcome-screen-users-get.test.ts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` initially failed because `tsgo` was unavailable before dependencies were installed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci` passed and left package manifests unchanged.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` passed; wrote 1187 schemas.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` passed; wrote 529 paths and 1187 schemas, with existing webhooks route-metadata warnings.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` passed; wrote `Spacebar is missing 539`, `Spacebar implements 641`, `Discord implements 1128`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` passed; wrote 746 entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` passed; wrote 721 contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` passed; wrote 15 suites.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-analytics-welcome-screen-users-get.test.js` passed: 6 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: 13 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` failed only on the known unrelated runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`; generated contract checks passed before runtime.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx prettier --write worker-progress/guilds-param-analytics-welcome-screen-users-get.md` passed.
- Completion audit reruns:
    - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` passed.
    - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` passed.
    - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-analytics-welcome-screen-users-get.test.js` passed: 6 tests.
    - Artifact audit script verified the exact source catalog entry, Userdoccers entry, missing-route removal, missing counts, manifest entry, HTTP contract entry, suite coverage entry, response schema, bucket schema, and OpenAPI path for `api:http:GET:/guilds/:guild_id/analytics/welcome-screen/users/`.
    - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest` passed.
    - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check` passed.
    - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
    - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: 13 tests.
    - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` again failed only on the known unrelated runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`; generated contract checks passed before runtime.
    - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
    - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` passed.
    - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
    - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` passed; wrote `Spacebar is missing 539`, `Spacebar implements 641`, `Discord implements 1128`.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json --exit-code` passed.
- Changed-file warranty string scan passed.

## Completion Audit

- Exact route implemented: verified by `src/api/routes/guilds/#guild_id/analytics/welcome-screen/users.ts` and the regenerated source catalog entry for `GET /guilds/{guild_id}/analytics/welcome-screen/users`.
- Route name preserved: verified as `GET_GUILDS_GUILD_ID_ANALYTICS_WELCOME_SCREEN_USERS` in source and Userdoccers catalogs.
- Permission boundary preserved: route metadata and generated manifest/contract all require `VIEW_GUILD_INSIGHTS`; auth mode is bearer.
- Query behavior covered: focused tests assert valid analytics queries, unsupported intervals, and reversed windows.
- Guild existence checked: focused tests assert `Guild.findOneOrFail({ where: { id }, select: { id: true } })`.
- Analytics privacy/truthfulness preserved: implementation returns `[]` with no fabricated metrics because no source-backed aggregate store exists.
- Response schema generated: `GuildWelcomeScreenUsersResponse` is an array of buckets requiring `day_pt` and `users_viewed_welcome_screen`.
- Generated artifacts updated: schema, OpenAPI, source route catalog, missing-route report, testing manifest, HTTP contracts, and suite coverage all include or remove the expected assigned-route data.
- Missing-route report movement verified: `missing 540 -> 539`, `spacebar 640 -> 641`, `discord 1128`, exact assigned missing entry removed.
- Adjacent route scope respected: no adjacent growth/retention/query, welcome-screen mutation, or unrelated guild route was implemented.

## Risks And Blockers

- No blocker remains for the assigned route.
- The route returns empty analytics data until Spacebar has source-backed welcome-screen user view aggregate persistence and privacy-threshold handling.
- `npm run test:contracts` remains blocked by the known unrelated `GET /discovery/search` runtime `500 !== 200` failure.

## Reconciliation Notes

- Package manifests and lockfiles are unchanged.
- Generated assets were regenerated after the route and schema changes.
- The implementation follows the adjacent welcome-screen funnel and guild analytics route pattern rather than adding new analytics storage or broader query behavior.
