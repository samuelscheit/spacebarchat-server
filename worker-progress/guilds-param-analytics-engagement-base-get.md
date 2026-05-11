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

# GET /guilds/{param}/analytics/engagement/base

## Summary

Implemented the missing authenticated `GET /guilds/{guild_id}/analytics/engagement/base` route. The route requires `VIEW_GUILD_INSIGHTS`, validates the Userdoccers `start`, `end`, and `interval` query parameters, performs an explicit guild lookup, and returns a typed empty engagement bucket list because Spacebar does not currently persist Discord guild engagement analytics buckets.

## Changed Files

- `src/api/routes/guilds/#guild_id/analytics/engagement/base.ts`
- `src/api/routes/guilds/#guild_id/analytics/engagement/base.test.ts`
- `src/schemas/responses/GuildEngagementBaseResponse.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-analytics-engagement-base-get.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` had one assigned entry: `GET_GUILDS_GUILD_ID_ANALYTICS_ENGAGEMENT_BASE` for `/guilds/{param}/analytics/engagement/base`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` had no assigned route implementation.
- Userdoccers `resources/guild-analytics.mdx` documents this endpoint as returning a list of engagement base objects and accepting common `start`, `end`, and `interval` query parameters.
- Userdoccers engagement base fields are `day_pt`, `visitors`, `communicators`, optional `pct_communicators`, `messages`, `messages_per_communicator`, and `speaking_minutes`.
- Spacebar has `VIEW_GUILD_INSIGHTS` in `src/util/util/Permissions.ts`; this is the closest source-backed guild analytics permission.
- Spacebar has no durable guild engagement analytics/event bucket storage for visitors, communicator thresholds, or speaking minutes. Existing analytics-compatible routes use conservative empty or zero responses when Discord analytics backing state is absent.

## Assigned Path And Methods

- Assigned path: `/guilds/{param}/analytics/engagement/base`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Source route: `/guilds/{guild_id}/analytics/engagement/base`

## Behavior

- Added route metadata with bearer security, `VIEW_GUILD_INSIGHTS`, query docs, and `200`, `401`, `403`, `404`, and `422` response schemas.
- Added query parsing for ISO8601 `start` and `end`, aggregation `interval` values `0`, `1`, `2`, and `3`, duplicate query rejection, and `start <= end` validation.
- Added explicit `Guild.findOneOrFail({ where: { id: guild_id }, select: { id: true } })`.
- Added `GuildEngagementBaseResponse` schema and exported it.
- Added focused compiled route tests for metadata, valid empty response, query validation, guild lookup behavior, and generated route artifacts.

## Missing-Route Count Movement

- Worker-base movement was from `800` to `799` missing entries, with the assigned entry removed.
- Current-base movement was from `709` to `708` missing entries, with Spacebar implemented routes moving from `471` to `472`.

## Verification

- Worker verification on its branch base passed: `npm ci`, `npm run build:src:tsgo`, `npm run build:test-fixtures`, focused compiled route test, automatic reverse-engineering build, source route import, missing-routes build/start, `npm run generate:schema`, testing manifest generation/verify, contract regeneration/checks, suite coverage regeneration/checks, `npm run generate:openapi`, `git diff --check`, and malformed AGPL warranty-line check.
- Orchestrator current-base verification on `7f84865f5` passed:
  `npm run build:src:tsgo`, `npm run generate:schema`,
  `npm run build:test-fixtures`, focused compiled engagement-base route test,
  `npm run build --workspace @spacebar/automatic-reverse-engineering`, source
  route catalog import, `npm run build --workspace @spacebar/missing-routes`,
  `npm run start --workspace @spacebar/missing-routes`,
  `npm run generate:testing-manifest`,
  `node scripts/testing-manifest/verify.js`, contract generation/checks, suite
  coverage generation/checks, generated contract/suite tests,
  `npm run generate:openapi`, focused ESLint/Prettier, `git diff --check`,
  package manifest/lockfile cleanliness check, exact warranty-line scan, and
  malformed warranty-string scan.

## Userdoccers/xHyroM References Used

- Primary: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild-analytics.mdx`
- Local Userdoccers catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
- xHyroM checked: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`; no assigned base route entry was present, only adjacent analytics routes such as engagement overview.

## Goal Status Evidence

- Worker `create_goal` objective: implement the missing route path `GET /guilds/{param}/analytics/engagement/base` for the Spacebar server API.
- Worker initial `get_goal` status/objective: `active`, same objective.
- Worker pane reported goal completion and final goal usage of 833 seconds; the report text also captured a final pre-handoff `get_goal` snapshot with `tokensUsed = 228060`, `timeUsedSeconds = 761`.

## Risks Or Blockers

- Spacebar does not persist Discord-style guild engagement analytics buckets. The compatibility response is intentionally `[]` instead of fabricated visitor, retention, voice, or engagement history.
- Future durable analytics storage could replace `createGuildEngagementBaseResponse()` with real bucket aggregation without changing the route contract.
