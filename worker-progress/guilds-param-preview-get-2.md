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

# guilds-param-preview-get-2

## Goal Evidence

- `create_goal`: active objective `Implement production-ready support for the missing route path GET /guilds/{guild_id}/preview on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal`: active objective `Implement production-ready support for the missing route path GET /guilds/{guild_id}/preview on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `update_goal`: complete; time used `1344` seconds; final token usage reported by tool `655993`.

## Assignment

- Worker id: `guilds-param-preview-get-2`
- Assigned path: `/guilds/{param}/preview`
- Expected source route: `/guilds/{guild_id}/preview`
- Missing methods found: `GET` only.
- Methods implemented: `GET`.
- Out-of-scope adjacent paths: `/guilds/{param}`, `/guilds/{param}/basic`, `/guilds/{param}/discovery-*`, `/guilds/{param}/vanity-url`, `/guild-recommendations`, and `/discoverable-guilds` were not implemented or modified for route behavior.

## Evidence

- `packages/missing-routes/missing.json` initially had one owned entry: `GET_GUILDS_GUILD_ID_PREVIEW`, route `/guilds/{param}/preview`, sources `userdoccers:resources/guild.mdx` and `xhyrom:data/client/routes.json`, source route `/guilds/{guild_id}/preview`.
- Pre-implementation checks found no `/guilds/{guild_id}/preview` implementation in `src/api/routes/**` and no owned entry in `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `GET`, `HEAD`, and `OPTIONS` for `/guilds/{guild_id}/preview`; only `GET` was missing in `missing.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `GET_GUILDS_GUILD_ID_PREVIEW` with summary `Get Guild Preview`.
- Userdoccers guild docs: `GET /guilds/{guild.id}/preview` returns a partial guild object with all partial fields; if the user is not in the guild, the guild must be discoverable. Reference: https://docs.discord.food/resources/guild#get-guild-preview
- Nearby local behavior: `GET /guilds/{guild_id}/basic` is bearer-authenticated, allows members and discoverable non-members, and returns `UNKNOWN_GUILD` for missing or hidden guilds.

## Behavior

- Auth mode: bearer-authenticated route; route metadata declares `401: { body: "APIErrorResponse" }`.
- Access: existing guild members can preview the guild; authenticated non-members can preview only guilds with `DISCOVERABLE` and `discovery_excluded !== true`.
- Error semantics: missing guilds, non-discoverable non-member access, and discovery-excluded non-member access all return Discord `UNKNOWN_GUILD` (`404`, code `10004`).
- Response schema: `GuildPreviewResponse` with `id`, `name`, nullable `icon`, nullable `description`, nullable `splash`, nullable `discovery_splash`, `features`, `emojis`, `stickers`, `approximate_member_count`, and `approximate_presence_count`.
- Data source: `Guild` selected fields plus `emojis` and `stickers` relations; member and presence counts are computed from local `Member` rows and online user sessions.
- Deliberately omitted unsourced/fabricated fields such as `home_header`, `banner`, `member_count`, and discovery metadata beyond locally stored preview fields.

## Changed Files

- `src/api/routes/guilds/#guild_id/preview.ts`
- `src/schemas/responses/GuildPreviewResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-preview-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-preview-get-2.md`

## Commands Run

- `mkdir -p worker-progress`: passed.
- `npm run build:src:tsgo`: passed on the current integration base.
- `npm run generate:schema`: passed; found 405 schemas and wrote 874 schema definitions.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; reported `Spacebar is missing 730`, `Spacebar implements 450`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: failed stale; `npm run generate:contract-tests` passed; rerun check passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: failed stale; `npm run generate:suite-coverage` passed; rerun check passed.
- `npm run generate:openapi`: passed; generated 358 paths and 874 schemas.
- `npm run build:test-fixtures`: passed.
- `NODE_OPTIONS=--preserve-symlinks node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-preview-route.test.js`: passed, 8 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `npx eslint src/api/routes/guilds/#guild_id/preview.ts src/schemas/responses/GuildPreviewResponse.ts src/schemas/responses/index.ts test/routes/guilds-preview-route.test.ts`: passed.
- `npx prettier --check src/api/routes/guilds/#guild_id/preview.ts src/schemas/responses/GuildPreviewResponse.ts src/schemas/responses/index.ts test/routes/guilds-preview-route.test.ts worker-progress/guilds-param-preview-get-2.md`: failed initially, files were formatted with Prettier, rerun passed.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no package manifest or lockfile changes.
- Changed-file malformed warranty-string scan: passed.

## Generated Artifact Evidence

- `routes.source.catalog.json` now includes `GET /guilds/{guild_id}/preview`, source `src/api/routes/guilds/#guild_id/preview.ts`, response schema refs `APIErrorResponse` and `GuildPreviewResponse`.
- `missing.json` no longer contains any `GET /guilds/{param}/preview` entry.
- `assets/testing-manifest.json` now includes `api:http:GET:/guilds/:guild_id/preview/` with `authMode: "bearer"` and response statuses `200`, `401`, and `404`.
- `assets/openapi.json` now includes `/guilds/{guild_id}/preview/` with `GuildPreviewResponse`, `APIErrorResponse`, and bearer security.

## Missing-Route Count Movement

- Before regeneration on current base: `731`.
- After regeneration on current base: `730`.
- Net movement for owned path: `-1`.

## Risks And Notes

- Count values are computed live from local membership/session data. This avoids fabricated preview counts, but it may be heavier than cached counters for very large guilds.
- Worker output included an unrelated `src/api/util/handlers/ChannelMessageCreateRoute.ts` type annotation from its old-base verification environment. That change was not ported to the current integration worktree.
- No blockers remain.

## Recommended Next Tasks

- Continue the missing-route backlog with adjacent guild routes only as separately assigned work.
