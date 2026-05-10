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

# guilds-param-basic-get

## Goal Evidence
- `create_goal`: status active; objective "Implement production-ready support for the missing route path `/guilds/{param}/basic` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report."
- `get_goal`: status active; objective "Implement production-ready support for the missing route path `/guilds/{param}/basic` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report."
- `update_goal`: status complete; tokens used 294332; time used 798 seconds.

## Assignment
- Worker id: `guilds-param-basic-get`
- Assigned path: `/guilds/{param}/basic`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Owned missing entry: `GET_GUILDS_GUILD_ID_BASIC`
- Out of scope and not implemented: `/guilds/{param}`, `/guilds/{param}/preview`, `/guilds/{param}/profile`, `/guilds/{param}/members/@me`, guild onboarding, guild feed, guild analytics.

## Evidence Gathered
- `packages/missing-routes/missing.json`: one owned `missing_entries[]` item for `GET /guilds/{param}/basic`; sources were `userdoccers:resources/guild.mdx` and `xhyrom:data/client/routes.json`; source route `/guilds/{guild_id}/basic`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: no existing `/guilds/{guild_id}/basic` entry before implementation; regenerated catalog now has `GET /guilds/{guild_id}/basic` from `src/api/routes/guilds/#guild_id/basic.ts`.
- `src/api/routes/**`: no existing basic guild route before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`: `GET /guilds/{guild_id}/basic`, summary `Get Guild Basic`, source `userdoccers:resources/guild.mdx`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`: route name `GUILD_BASIC`; xHyroM lists GET/HEAD/OPTIONS, while the missing report owns only GET.
- `packages/automatic-reverse-engineering/data/catalogs/source-refs.json`: Userdoccers commit `259d8f8cf97ff357c4d1255afdf30e2e05672742`, xHyroM routes commit `0d792408fc6f5f67140fe1b4cad48b386ae1fd44`.
- Userdoccers guild docs at `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/259d8f8cf97ff357c4d1255afdf30e2e05672742/pages/resources/guild.mdx`: `Get Guild Basic` returns a partial guild; non-members may access only if the guild is discoverable; approximate counts are not included for this endpoint.

## Behavior Implemented
- Auth mode: authenticated bearer route. Metadata includes `401: { body: "APIErrorResponse" }`.
- Authorization/visibility: no guild permission is required. Existing members can fetch the basic guild response. Authenticated non-members can fetch only when the guild has the `DISCOVERABLE` feature and is not `discovery_excluded`.
- Response schema: new `GuildBasicResponse` with source-backed local fields only: `id`, `name`, `icon`, `description`, `splash`, `discovery_splash`, and `features`.
- Data source: `Guild.findOne` with a narrow select, plus `Member.findOne` for membership visibility.
- Error semantics: missing guilds, non-discoverable non-member access, and discovery-excluded non-member access return Discord unknown-guild body with HTTP 404. Missing auth is handled by the shared authentication middleware as 401.
- Deliberately omitted fields: member counts, presence counts, preview-only emoji/sticker arrays, banner, profile fields, premium state, and unsupported `home_header`.

## Changed Files
- `src/api/routes/guilds/#guild_id/basic.ts`
- `src/schemas/responses/GuildBasicResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-basic-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-basic-get.md`

## Verification Commands
- Dependency locality/install guard: passed; `node_modules` was installed locally with `npm ci`.
- Worker-base verification passed: source build, schema generation, test fixture build, focused route tests 8/8, automatic reverse-engineering build, source catalog import, missing-routes build/start, testing manifest verification, generated contract and suite coverage checks after regeneration, generated contract/suite tests 13/13, OpenAPI generation, diff checks, package manifest/lockfile guard, and malformed warranty-string scan.
- Current-base verification on `4c8d31be6` passed: `npm run build:src:tsgo`, `npm run generate:schema`, `npm run build --workspace @spacebar/automatic-reverse-engineering`, source catalog import, `npm run build --workspace @spacebar/missing-routes`, `npm run start --workspace @spacebar/missing-routes`, `npm run generate:testing-manifest`, `node scripts/testing-manifest/verify.js`, generated contract regeneration/check, generated suite coverage regeneration/check, `npm run generate:openapi`, `npm run build:test-fixtures`, focused compiled route tests 8/8, generated contract/suite tests 13/13, `git diff --check`, package manifest/lockfile guard, malformed warranty-string scan, and artifact spot-checks for `/guilds/{guild_id}/basic/`.
- Current-base `npm run generate:schema`: passed, wrote 864 schemas.
- Current-base `npm run start --workspace @spacebar/missing-routes`: passed; output `Spacebar is missing 739`, `Spacebar implements 441`, `Discord implements 1128`.
- Current-base `npm run generate:testing-manifest`: passed; wrote 546 entries.
- Current-base generated HTTP contract check: passed after regeneration with 521 contracts.
- Current-base generated suite coverage check: passed after regeneration.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13/13 tests.
- `npm run generate:openapi`: passed; generated 350 paths and 864 schemas. Existing warnings remain for unrelated webhook routes missing route metadata.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no dependency manifest changes.
- Changed-file malformed warranty-string scan: passed; no matches.

## Missing-Route Count Movement
- Worker-base movement: 765 missing entries to 764 missing entries.
- Current-base movement: 740 missing entries to 739 missing entries; implemented routes moved from 440 to 441.
- Owned route movement: `GET /guilds/{param}/basic` removed from `packages/missing-routes/missing.json`.

## Risks And Notes
- The route exposes a conservative subset of the documented partial guild because Spacebar does not currently persist every Discord partial-guild field.
- Local discoverability uses both `DISCOVERABLE` and `discovery_excluded === false`, matching Spacebar discovery listing behavior.
- The shared `DiscordApiErrors.UNKNOWN_GUILD` constant defaults to HTTP 400, so this route uses a local unknown-guild `ApiError` with HTTP 404 to match route metadata and expected missing-resource semantics without changing global behavior.
- No package manifests or lockfiles were changed.

## Recommended Next Tasks
- Consider whether `DiscordApiErrors.UNKNOWN_GUILD` should globally default to HTTP 404 in a separate, broader compatibility task.
- Implement adjacent missing guild paths only through their own assigned workers, using their own source evidence.
