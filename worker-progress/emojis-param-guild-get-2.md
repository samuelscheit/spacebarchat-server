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

# Worker Progress: emojis-param-guild-get-2

## Goal Evidence

- `create_goal`: objective set to "Implement production-ready support for the missing route path `/emojis/{param}/guild` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report."
- `get_goal`: status `active`; objective matched the assigned route support objective.
- `update_goal(status: "complete")`: status `complete`; final goal time used was 725 seconds.

## Summary

Implemented GET `/emojis/{emoji_id}/guild` for the assigned missing route. The route is bearer-authenticated, returns `404 UNKNOWN_EMOJI` when the emoji is absent or when the owning guild is not visible through discovery, and returns a source-backed discoverable guild payload for valid discoverable guild emoji.

## Scope

- Worker id: `emojis-param-guild-get-2`
- Assigned path: `/emojis/{param}/guild`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Adjacent routes intentionally not implemented: `/emojis/{param}/source`, guild emoji CRUD/list routes, sticker routes, CDN emoji assets, emoji search routes

## Evidence

- `packages/missing-routes/missing.json` before implementation had one owned entry: `GET /emojis/{param}/guild`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `GET /emojis/{emoji_id}/guild` entry before implementation.
- `src/api/routes/**` had no `emojis/#emoji_id/guild.ts` route before implementation.
- Userdoccers `resources/emoji.mdx` says Get Emoji Guild returns a discoverable guild for the emoji owner and requires the guild to be discoverable, not auto-removed, and expression-discoverability-enabled.
- Userdoccers `resources/discovery.mdx` defines the discoverable guild fields and notes Get Emoji Guild returns emoji-related fields limited to 30 entries plus `emoji_count`.
- xHyroM route catalog confirms `GET /emojis/{emoji_id}/guild` with route name `EMOJI_GUILD_DATA`.

## Changed Files

- `src/api/routes/emojis/#emoji_id/guild.ts`: new authenticated route, injectable data access, discoverability guard, 404 behavior, vanity invite and count lookups, response serialization.
- `src/schemas/responses/EmojiGuildResponse.ts`: new response schema for Get Emoji Guild.
- `src/schemas/responses/index.ts`: exported `EmojiGuildResponse`.
- `test/routes/emojis-param-guild-route.test.ts`: focused route tests for auth, unknown emoji, discoverability filtering, response shape, and generated artifacts.
- `assets/schemas.json`: regenerated schema catalog.
- `assets/openapi.json`: regenerated OpenAPI route entry.
- `assets/testing-manifest.json`: regenerated testing manifest.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: regenerated source route catalog.
- `packages/missing-routes/missing.json`: regenerated missing-route report.
- `test/generated/http-contracts.json`: regenerated contract matrix.
- `worker-progress/emojis-param-guild-get-2.md`: this handoff report.

## Behavior

- Auth: route is not in `NO_AUTHORIZATION_ROUTES`; OpenAPI and manifest mark bearer auth, and route metadata declares `401: APIErrorResponse`.
- Success: returns `EmojiGuildResponse` with backed guild fields, active vanity invite code if present, exact local member/presence counts, up to 30 guild emoji rows, total `emoji_count`, discovery category, and publication flags.
- Unknown/hidden: missing emoji, missing guild, non-`DISCOVERABLE` guild, or `discovery_excluded` guild all return `404` with `UNKNOWN_EMOJI` to avoid leaking hidden guild ownership.
- Unsupported discovery fields such as keywords, reasons to join, social links, and discovery categories are omitted rather than fabricated.

## Missing-Route Movement

- Before regeneration: 771 missing routes; owned entry present as `GET /emojis/{param}/guild`.
- After regeneration: 770 missing routes; owned entry removed.
- Source catalog now contains `GET /emojis/{emoji_id}/guild` from `src/api/routes/emojis/#emoji_id/guild.ts` with response schema refs `APIErrorResponse` and `EmojiGuildResponse`.

## Commands Run

- `npm ci`
- `npm run build:src:tsgo` (first attempt failed before install because this worktree had no `node_modules/@types/node`)
- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build:test-fixtures`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` (reported stale)
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run generate:openapi`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/emojis-param-guild-route.test.js`
- `git diff --check`
- `git diff --check --no-index /dev/null ...` for new untracked files
- malformed warranty-token scan for changed source/test files

## Verification Results

- Source build: pass after installing dependencies.
- Schema generation: pass.
- Test fixture build: pass.
- Focused route test: pass, 5 tests.
- Automatic reverse engineering workspace build: pass.
- Missing routes workspace build and start: pass.
- Testing manifest verify: pass, 515 entries.
- Contract tests check: pass after regeneration, 490 contracts.
- Suite coverage check: pass.
- Generated HTTP/suite tests: pass, 13 tests.
- OpenAPI generation: pass, 327 paths and 816 schemas.
- `git diff --check`: pass.
- Malformed warranty-token scan: pass for changed source/test files.

## Risks And Notes

- Spacebar currently models guild expression discoverability as always enabled in discovery metadata, with no persisted false state. The route enforces the source-backed gates available locally: `DISCOVERABLE` feature and `discovery_excluded !== true`.
- Member and presence counts are exact local database counts, used as the source-backed values for the documented approximate count fields.
- Vanity URL is backed by active vanity invites; expired vanity invites are ignored for this read path and not mutated.

## Recommended Next Tasks

- Consider extracting a shared discoverable-guild response helper if future workers implement sticker or soundboard guild-source routes.
- Consider adding a persisted guild expression discoverability flag if Spacebar wants to distinguish that Discord visibility gate from ordinary guild discovery publication.
