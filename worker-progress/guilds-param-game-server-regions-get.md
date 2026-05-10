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

# guilds-param-game-server-regions-get

## Goal Evidence

- `create_goal`: created active goal for implementing production-ready support for `/guilds/{param}/game-server-regions`.
- `get_goal`: status `active`; objective matched the worker assignment.
- `update_goal`: status `complete`; final tool report time used 622 seconds.

## Assignment

- Assigned path: `/guilds/{param}/game-server-regions`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Out of scope and not implemented: `/guilds/{param}/regions`, `/guilds/{param}/game-servers`, `/guilds/{param}/game-servers/{param}/wake`, voice-region routes, guild preview/basic routes, and guild analytics routes.

## Evidence

- `packages/missing-routes/missing.json` initially contained exactly one owned entry: `GET /guilds/{param}/game-server-regions`, route name `GET_GUILDS_GUILD_ID_GAME_SERVER_REGIONS`, source `userdoccers:resources/guild.mdx`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no `/guilds/{guild_id}/game-server-regions` entry.
- `src/api/routes/**` initially had no `game-server-regions` route.
- Userdoccers guild resource documents "Get Guild Game Server Regions" and the game server region fields `id`, `name`, `country_code`, and `ping_url`: https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild.mdx
- Existing local patterns reviewed: `src/api/routes/guilds/#guild_id/regions.ts`, `src/api/routes/voice/regions.ts`, `src/api/routes/guilds/#guild_id/channels.ts`, `src/api/util/utility/ChannelVisibility.ts`, and `src/api/util/handlers/Voice.ts`.

## Behavior

- `GET /guilds/:guild_id/game-server-regions/` is bearer-authenticated and remains absent from no-authorization routes.
- The handler verifies the guild exists, then requires the requester to be a guild member.
- Response metadata documents `200 GameServerRegionsResponse` and `401`, `403`, `404` `APIErrorResponse`.
- The response is an array of configured game-server regions with `id`, `name`, `country_code`, and `ping_url`.
- Data source is local configuration at `Config.get().guild.gameServerRegions`; incomplete entries are filtered out instead of synthesizing unavailable data.
- Unknown guilds return `404`; authenticated non-members return `403`; missing bearer auth returns `401` through the shared authentication middleware.

## Changed Files

- `src/api/routes/guilds/#guild_id/game-server-regions.ts`
- `src/schemas/responses/GameServerRegionsResponse.ts`
- `src/schemas/responses/index.ts`
- `src/util/config/types/GuildConfiguration.ts`
- `test/routes/guilds-game-server-regions.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-game-server-regions-get.md`

## Verification

- `if [ -L node_modules ]; then unlink node_modules; fi; if [ ! -d node_modules ]; then npm ci; fi` - passed
- `npm run build:src:tsgo` - passed
- `npm run generate:schema` - passed
- `npm run build:test-fixtures` - passed
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed
- `npm run build --workspace @spacebar/missing-routes` - passed
- `npm run start --workspace @spacebar/missing-routes` - passed
- `npm run generate:testing-manifest` - passed
- `node scripts/testing-manifest/verify.js` - passed
- `node scripts/testing-manifest/generate-contract-tests.js --check` - initially stale; passed after `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - initially stale; passed after `npm run generate:suite-coverage`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed
- `npm run generate:openapi` - passed
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-game-server-regions.test.js` - passed
- `git diff --check` - passed
- package manifest/lockfile cleanliness check - passed; no dependency manifest changes
- changed-file malformed warranty-string scan - passed

## Current-Base Orchestrator Verification

- Ported scoped source, schema, config, test, and report changes onto
  `11aad02a9 Implement detectable non-game applications route`; regenerated
  generated artifacts on that base instead of copying worker artifacts.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote 822 schemas.
- `npm run build:test-fixtures`: passed.
- Focused compiled route test:
  `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-game-server-regions.test.js`:
  passed, 7/7 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route import: passed and added
  `/guilds/{guild_id}/game-server-regions`.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed,
  `missing: 761`, `spacebar: 419`.
- `npm run generate:testing-manifest`: passed, 524 entries.
- `node scripts/testing-manifest/verify.js`: passed, 524 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: stale
  before regeneration.
- `npm run generate:contract-tests`: passed, 499 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed,
  499 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: stale
  before regeneration.
- `npm run generate:suite-coverage`: passed, 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`:
  passed, 13/13 tests.
- `npm run generate:openapi`: passed, 334 paths and 822 schemas. The webhook
  route-metadata warnings are pre-existing.

## Generated Artifact Evidence

- Source catalog now contains `GET /guilds/{guild_id}/game-server-regions` with source `src/api/routes/guilds/#guild_id/game-server-regions.ts` and response schemas `APIErrorResponse`, `GameServerRegionsResponse`.
- Testing manifest now contains `api:http:GET:/guilds/:guild_id/game-server-regions/` with auth mode `bearer`, statuses `200`, `401`, `403`, `404`, and guild route rate-limit metadata.
- OpenAPI now contains `/guilds/{guild_id}/game-server-regions/`.
- Missing-route count moved from 764 to 763; assigned route remaining count is 0.

## Risks And Follow-Up

- Spacebar does not currently persist Discord game-server inventory, provider capacity, latency, stock, or wake state; this route intentionally exposes only configured region metadata.
- Operators must configure `guild.gameServerRegions` to return non-empty game-server region data.
- Recommended next tasks: implement the adjacent `/guilds/{param}/game-servers` and wake routes only with a real persistence/provider model, or document them as unsupported if no local backing is planned.
