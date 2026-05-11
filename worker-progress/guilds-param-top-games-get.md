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

# Guilds Param Top Games GET

## Summary

Implemented the assigned missing route only: `GET /guilds/{guild_id}/top-games`.
The route is authenticated, requires `MANAGE_GUILD`, declares explicit `401`
metadata, and returns a conservative source-compatible payload:

```json
{ "top_games": [] }
```

Spacebar does not currently have durable/source-backed guild playtime ranking
data, so this implementation does not fabricate application rankings,
activity scores, or play counts.

## Goal Evidence

- Worker `create_goal`: created active goal for "Implement production-ready
  support for the missing route path `/guilds/{guild_id}/top-games` on the
  current integration branch, with focused tests, regenerated route catalogs and
  generated route artifacts, verification evidence, and a complete handoff
  report."
- Worker `get_goal`: confirmed status `active` with the same objective before
  route research and implementation.
- Worker `update_goal`: marked the goal `complete`; final tool result reported
  `tokensUsed: 273241`, `timeUsedSeconds: 605`, and completion budget report
  `Goal achieved. Report final budget usage to the user: time used: 605 seconds.`

## Brief And Scope

- Read `/Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`.
- Did not read `ORCHESTRATOR.md`.
- Missing-report path form: `/guilds/{param}/top-games`.
- Methods found in `packages/missing-routes/missing.json`: `GET` only.
- Methods implemented: `GET` only.
- Adjacent guild routes such as top-emojis, top-read-channels, analytics,
  discovery, and onboarding were not implemented.

## Evidence Used

- `packages/missing-routes/missing.json`: initial missing entry was
  `GET /guilds/{param}/top-games` with sources
  `userdoccers:resources/guild.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`:
  no source implementation existed before this change.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`:
  `GET /guilds/{guild_id}/top-games`, summary `Get Guild Top Games`, source
  `userdoccers:resources/guild.mdx`.
- Userdoccers source URL:
  `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild.mdx`.
  The route is documented as requiring `MANAGE_GUILD` and returning `top_games`
  game activity objects.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`:
  xHyroM lists `GET`, `HEAD`, and `OPTIONS` for
  `/guilds/{guild_id}/top-games`; only `GET` was present in the current missing
  report for this assignment.
- Local capture evidence:
  `packages/automatic-reverse-engineering/data/runs/2026-05-07T23-06-28Z-stable-local/features/guild.role.edit.basic/report.md`
  records `GET /guilds/{guild_id}/top-games` returning status `200` with
  response sample `{"top_games":[]}`.

## Behavior

- `GET /guilds/:guild_id/top-games/` returns `200` with
  `GuildTopGamesResponse`.
- The response currently contains an empty `top_games` array because no local
  durable ranking store exists for guild game activity.
- The route uses the existing `route()` middleware permission model with
  `permission: "MANAGE_GUILD"`.
- Bearer authentication is required by default; the route is not added to
  no-authorization routes.
- Route metadata declares response bodies for `200`, `401`, and `403`.

## Schemas

- Added `GuildTopGamesResponse`:
    - `top_games: GuildTopGameActivity[]`
- Added `GuildTopGameActivity`:
    - `game_application_id: string`
    - `activity_level: number`
    - `activity_score: number`
- Regenerated `assets/schemas.json` and `assets/openapi.json`.

## Changed Files

- `src/api/routes/guilds/#guild_id/top-games.ts`
- `src/schemas/responses/GuildTopGamesResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-top-games.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Generated Artifact Results

- Source catalog now includes `GET /guilds/{guild_id}/top-games` from
  `src/api/routes/guilds/#guild_id/top-games.ts`.
- Worker-base missing-route movement:
    - Before: missing `712`, Spacebar `468`, Discord `1128`.
    - After: missing `711`, Spacebar `469`, Discord `1128`.
- Current-base missing-route movement:
    - Before: missing `710`, Spacebar `470`, Discord `1128`.
    - After: missing `709`, Spacebar `471`, Discord `1128`.
- Testing manifest now has `api:http:GET:/guilds/:guild_id/top-games/`, bearer
  auth, `MANAGE_GUILD`, response bodies `APIErrorResponse` and
  `GuildTopGamesResponse`, and statuses `200`, `401`, `403`.
- HTTP contract matrix and suite coverage are regenerated on the current base
  during orchestrator verification.
- OpenAPI includes `/guilds/{guild_id}/top-games/` with bearer security,
  `x-permission-required: MANAGE_GUILD`, and the new response schema.

## Verification

- Worker verification on branch base passed: `npm run build:src:tsgo`,
  `npm run generate:schema`, `npm run build:test-fixtures`, focused route test,
  reverse-engineering build and source catalog import, missing-routes
  build/start, testing manifest generation and verify, contract/suite
  generation checks after regeneration, generated contract and suite tests,
  `npm run generate:openapi`, focused eslint/prettier, `git diff --check`,
  package manifest/lockfile cleanliness, malformed warranty scan, and exact
  warranty-line scan.
- Orchestrator current-base verification on `f65207aa9` passed:
  `npm run build:src:tsgo`, `npm run generate:schema`,
  `npm run build:test-fixtures`, focused compiled route test,
  `npm run build --workspace @spacebar/automatic-reverse-engineering`, source
  route catalog import, `npm run build --workspace @spacebar/missing-routes`,
  `npm run start --workspace @spacebar/missing-routes`,
  `npm run generate:testing-manifest`,
  `node scripts/testing-manifest/verify.js`, contract generation/checks, suite
  coverage generation/checks, generated contract/suite tests,
  `npm run generate:openapi`, focused ESLint/Prettier, `git diff --check`,
  package manifest/lockfile cleanliness check, and malformed warranty-string
  scan.

## Risks And Follow-Ups

- The main functional gap is data: Spacebar currently has no durable
  source-backed guild game activity ranking store. This route should be updated
  if such a store or aggregation pipeline is introduced.
- xHyroM catalogs include `HEAD` and `OPTIONS`, but the current missing report
  assigned only `GET`; those methods were not added as source catalog entries.
- Recommended next tasks: implement durable guild game activity aggregation if
  product behavior requires non-empty rankings; handle top-read-channels as a
  separate assigned missing-route task.
