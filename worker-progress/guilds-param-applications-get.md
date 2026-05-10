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

# GET /guilds/{param}/applications

## Goal Evidence

- Worker `get_goal` status: `active`.
- Worker `get_goal` objective: `implement the missing route path GET /guilds/{param}/applications for the Spacebar server API`.
- Worker pane reported the goal was marked complete after verification.
- Audit risk: the worker report did not record the required `create_goal` evidence, so the orchestrator accepted the scoped implementation only after inspecting the pane, route, tests, source catalogs, and rerunning verification on current master.

## Assigned Path And Missing Methods

- Assigned path: `/guilds/{param}/applications`.
- Missing method found: `GET`.
- Missing entry found in `packages/missing-routes/missing.json`: `GET_GUILDS_GUILD_ID_APPLICATIONS`.
- Confirmed absent before editing on the current base:
  - No `/guilds/{guild_id}/applications` entry in `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`.
  - No `src/api/routes/guilds/#guild_id/applications.ts` route file existed.
- Did not implement adjacent guild application-command, integration, entitlement, request, onboarding, or other guild paths.

## Source References Used

- Userdoccers local catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
  - `GET /guilds/{guild_id}/applications`
  - route name `GET_GUILDS_GUILD_ID_APPLICATIONS`
  - source `userdoccers:resources/application.mdx`
  - summary `Get Guild Applications`
- xHyroM local catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  - `GET /guilds/{guild_id}/applications`
  - route name `GUILD_APPLICATIONS`
  - also lists `HEAD`/`OPTIONS`; the missing-route entry for this path was only `GET`.
- Userdoccers documentation describes the endpoint as returning applications attached to a guild, requiring `MANAGE_GUILD`, using `application.guild_id == guild.id`, and accepting `type`, `include_team`, and `channel_id` query parameters.

## Behavior Implemented

- Added `GET /guilds/:guild_id/applications/`.
- Requires authenticated bearer API access and `MANAGE_GUILD`.
- Declares explicit `401` and `403` response metadata.
- Returns `APIApplicationArray`.
- Queries durable local state through `Application.guild_id`.
- Supports `type` by adding an application type filter.
- Supports `include_team=true` by including team data only when the requester owns the application or is an accepted member of the owning team.
- Handles `channel_id` conservatively by returning `[]`; Spacebar has no durable channel-to-application attachment state for this filter.
- Handles malformed `type` conservatively by returning `[]`.

## Files Changed

- `src/api/routes/guilds/#guild_id/applications.ts`
- `test/routes/guilds-applications.test.ts`
- `src/schemas/responses/OAuthAuthorizeResponse.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Verification

- Ported the scoped source, test, and schema changes onto current master after `b789eab5c`.
- Regenerated current-base artifacts instead of reusing the worker's older generated artifacts.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed, wrote `864` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; missing-route report moved `739 -> 738` and implemented routes moved `441 -> 442`.
- `npm run generate:testing-manifest`: passed, wrote `547` entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `npm run generate:contract-tests`: passed, wrote `522` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `npm run generate:suite-coverage`: passed, wrote `15` suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:openapi`: passed, wrote `351` paths and `864` schemas; the existing unrelated webhook `route()` middleware warnings remain.
- `npm run build:test-fixtures`: passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-applications.test.js`: passed, 5/5 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13/13 tests.
- `git diff --check`: passed.
- Package manifest/lockfile guard: no package manifests or lockfiles changed.
- Malformed AGPL warranty-token scan: passed.

## Risks And Follow-Up

- `channel_id` filtering is intentionally fail-closed until Spacebar has a source-backed durable channel/application attachment model.
- The route returns guild-linked applications, not bot-member installations; this follows Userdoccers' `guild_id` attachment definition for this endpoint.
