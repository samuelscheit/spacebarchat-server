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

# guilds-param-top-emojis-get

## Goal Evidence

- Worker `create_goal`: status `active`; objective `Implement production-ready support for the missing route path `/guilds/{guild_id}/top-emojis` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Worker `get_goal`: status `active`; same objective as above.
- Worker final `update_goal(status: "complete")`: complete; time used 592 seconds, tokens used 264,098.

## Assignment

- Assigned missing-report path: `/guilds/{param}/top-emojis`.
- Source route path: `/guilds/{guild_id}/top-emojis`.
- Missing methods found: `GET` only, route name `GET_GUILDS_GUILD_ID_TOP_EMOJIS`.
- Methods implemented: `GET /guilds/:guild_id/top-emojis/`.
- Out of scope and untouched: adjacent guild analytics, guild emoji CRUD, top games, top read channels, onboarding, and other guild routes.

## Evidence Gathered

- Base `packages/missing-routes/missing.json` contained one owned entry for `GET /guilds/{param}/top-emojis`, sources `userdoccers:resources/emoji.mdx` and `xhyrom:data/client/routes.json`, source route `/guilds/{guild_id}/top-emojis`, summary `Get Guild Top Emojis`.
- Base `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no entry for `/guilds/{guild_id}/top-emojis`; regenerated source catalog now contains the implemented GET route.
- Local Userdoccers catalog lists `GET /guilds/{guild_id}/top-emojis` as `GET_GUILDS_GUILD_ID_TOP_EMOJIS`.
- Userdoccers `resources/emoji.mdx` (`https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/emoji.mdx`) documents `GET /guilds/{guild.id}/top-emojis`, response body `{ items: top emoji[] }`, and item fields `emoji_id` and `emoji_rank`.
- Local xHyroM catalog and raw xHyroM `data/client/routes.json` (`https://raw.githubusercontent.com/xHyroM/discord-datamining/master/data/client/routes.json`) identify `TOP_EMOJIS_FOR_GUILD` at `/guilds/:param/top-emojis` with allowed methods `GET`, `HEAD`, and `OPTIONS`; only `GET` was present in the missing-route report.
- Local captured client coverage for the expression picker and reaction flow shows authenticated `GET /guilds/{guild_id}/top-emojis` requests and a 200 response shaped as `{ "items": [] }`.

## Behavior

- Added authenticated bearer route metadata with explicit `401: APIErrorResponse`.
- Access model: verifies the guild exists, then requires the authenticated requester to be a guild member. There is no additional guild permission requirement.
- Response model: `200 GuildTopEmojisResponse` with `items: GuildTopEmojiResponseItem[]`, where each item has `emoji_id` and `emoji_rank`.
- Error model: unknown guild returns Discord `UNKNOWN_GUILD` with HTTP 404; non-members receive HTTP 403; missing or invalid bearer auth remains HTTP 401 via the authentication middleware.
- Data model: Spacebar currently has no durable, source-backed top emoji ranking table or usage counter for this Discord endpoint. The production default returns `items: []` rather than fabricating ranks from guild emoji rows or reaction snapshots. The route is dependency-injected so a future durable ranking provider can supply source-backed items without changing the HTTP contract.

## Changed Files

- `src/api/routes/guilds/#guild_id/top-emojis.ts`
- `src/schemas/responses/GuildTopEmojisResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-top-emojis-route.test.ts`
- `assets/schemas.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `assets/openapi.json`

## Generated Artifacts

- Schema generation added `GuildTopEmojisResponse` and `GuildTopEmojiResponseItem` to `assets/schemas.json`.
- Source route import added `GET /guilds/{guild_id}/top-emojis` with response refs `APIErrorResponse` and `GuildTopEmojisResponse`.
- Missing-route regeneration removed the owned entry.
- Testing manifest added `api:http:GET:/guilds/:guild_id/top-emojis/` with bearer auth, response statuses `200/401/403/404`, and guild route coverage policy.
- Contract and suite coverage JSON were regenerated after their `--check` commands reported staleness.
- OpenAPI now includes `/guilds/{guild_id}/top-emojis/` with bearer security and the new response schema.

## Commands Run

- Worker verification on branch base `e7549a138` passed: `npm run build:src:tsgo`, `npm run generate:schema`, `npm run build:test-fixtures`, focused compiled route test, route catalog import, missing-route regeneration, testing manifest verify, contract and suite coverage regeneration/checks, generated contract/suite tests, `npm run generate:openapi`, focused ESLint/Prettier, `git diff --check`, package manifest/lockfile cleanliness check, and malformed warranty-string scan.
- Orchestrator current-base verification on `a1b755039` passed: `npm run build:src:tsgo`, `npm run generate:schema`, `npm run build:test-fixtures`, `npm run build --workspace @spacebar/automatic-reverse-engineering`, source route catalog import, `npm run build --workspace @spacebar/missing-routes`, `npm run start --workspace @spacebar/missing-routes`, `npm run generate:testing-manifest`, `node scripts/testing-manifest/verify.js`, contract generation/checks, suite coverage generation/checks, `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`, `npm run generate:openapi`, focused compiled route test, focused ESLint/Prettier, `git diff --check`, package manifest/lockfile cleanliness check, and malformed warranty-string scan.

## Missing-Route Movement

- Worker-base regeneration moved the report from 714 to 713 missing entries.
- Current-base regeneration moved the report from 711 to 710 missing entries.
- Owned entry `GET /guilds/{param}/top-emojis` is absent from regenerated `packages/missing-routes/missing.json`.

## Risks And Follow-Ups

- Risk: clients that expect a populated Discord top-emoji list will receive an empty list until Spacebar has durable emoji usage ranking data. This is deliberate conservative compatibility behavior and avoids fabricated analytics.
- Recommended next task: add a durable top emoji usage/ranking data source if product requirements need non-empty rankings, then wire it through `findTopEmojiItems` and add data-backed tests.
- Recommended audit note: xHyroM lists `HEAD` and `OPTIONS`, but only `GET` was an owned missing method. Express/HTTP middleware behavior should be considered separately if the campaign later tracks HEAD/OPTIONS as first-class implemented methods.
