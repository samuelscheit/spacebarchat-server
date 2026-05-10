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

# guilds-param-voice-states-param-get

## Goal Evidence

- `create_goal`: active goal `019e13f4-f202-79e3-84bc-437e0d9941d2`.
- `get_goal`: status `active`; objective `Implement production-ready support for the missing route path `GET /guilds/{guild_id}/voice-states/{user_id}` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `update_goal`: status `complete`; final tool report `time used: 114 seconds`.

## Summary

Implemented production-ready support for `GET /guilds/{guild_id}/voice-states/{user_id}` using persisted local `VoiceState` records only. The route is authenticated, bot-only, checks guild and requester membership before target state access, verifies target membership and requester visibility for the voice channel, and returns a typed `VoiceStateResponse`.

Generated catalogs and route artifacts were refreshed. The exact owned missing-route entry was removed; adjacent current-user voice-state routes remain missing and out of scope.

## Assignment Scope

- Worker id: `guilds-param-voice-states-param-get`.
- Assigned path: `/guilds/{param}/voice-states/{param}`.
- Owned missing method found from the original missing catalog: `GET_GUILDS_GUILD_ID_VOICE_STATES_USER_ID`.
- Implemented method: `GET /guilds/{guild_id}/voice-states/{user_id}`.
- Out-of-scope adjacent paths left unimplemented: `GET /guilds/{guild_id}/voice-states/@me`, `PATCH /guilds/{guild_id}/voice-states/@me`, broader voice region/session behavior, channel voice routes, gateway voice events, and unrelated voice-state mutation semantics.

## Evidence Gathered

- The worker's launch-base `packages/missing-routes/missing.json` had 735 missing entries and exactly one owned entry for `/guilds/{param}/voice-states/{param}`:
    - Method: `GET`.
    - Route name: `GET_GUILDS_GUILD_ID_VOICE_STATES_USER_ID`.
    - Sources: `userdoccers:resources/voice.mdx`, `xhyrom:data/client/routes.json`.
    - Source routes: `/guilds/{guild_id}/voice-states/{user_id}`, `/guilds/{guild_id}/voice-states/{param}`.
- The current integration base before orchestrator port had 733 missing entries. After current-base regeneration, `packages/missing-routes/missing.json` has 732 missing entries and no entries for the exact owned route.
- Current adjacent entries still missing:
    - `GET /guilds/{param}/voice-states/@me`.
    - `PATCH /guilds/{param}/voice-states/@me`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` contains `GET /guilds/{guild_id}/voice-states/{user_id}`, source `userdoccers:resources/voice.mdx`, summary `Get User Voice State`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` contains `GET /guilds/{guild_id}/voice-states/{param}`, source `xhyrom:data/client/routes.json`.
- Userdoccers voice resource reference: `https://github.com/discord-userdoccers/discord-userdoccers/blob/master/pages/resources/voice.mdx`.
    - The Voice State object fields drove `VoiceStateResponse`.
    - The endpoint note drove bot-only behavior for user tokens.
- Current `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` now contains `GET /guilds/{guild_id}/voice-states/{user_id}` from `src/api/routes/guilds/#guild_id/voice-states/#user_id/index.ts`, with `APIErrorResponse` and `VoiceStateResponse` refs.

## Behavior

- Auth mode: bearer/authenticated route metadata, including explicit `401: { body: "APIErrorResponse" }`.
- Account mode: non-bot tokens are rejected with `DiscordApiErrors.BOT_ONLY_ENDPOINT` before guild or voice-state lookups.
- Guild semantics:
    - Missing guild returns `UNKNOWN_GUILD`.
    - Requester must be a guild member through the existing `assertGuildMember` helper.
- Voice-state semantics:
    - Looks up `VoiceState` by `{ guild_id, user_id }`.
    - Missing state or a state without `channel_id` returns `UNKNOWN_VOICE_STATE`.
    - Stale target membership returns `UNKNOWN_MEMBER`.
    - Hidden voice channel returns `MISSING_ACCESS` through `canViewChannel`.
- Response:
    - Uses persisted `VoiceState.toPublicVoiceState()` data only.
    - Serializes `request_to_speak_timestamp` to ISO string or `null`.
    - Does not fabricate session, channel, or voice state data.

## Changed Files

- `src/api/routes/guilds/#guild_id/voice-states/#user_id/index.ts`: added GET handler, metadata, dependency-injected lookup helper, response conversion, and bot-only/auth/visibility behavior.
- `src/api/routes/guilds/#guild_id/voice-states/#user_id/index.test.ts`: added focused route-adjacent tests for metadata, auth ordering, lookup/error behavior, response shape, generated artifacts, and exact missing-route ownership.
- `src/schemas/responses/VoiceStateResponse.ts`: added response schema interface.
- `src/schemas/responses/index.ts`: exported `VoiceStateResponse`.
- `tsconfig.test.json`: included the new route-adjacent test in test fixture builds.
- Regenerated artifacts:
    - `assets/schemas.json`.
    - `assets/openapi.json`.
    - `assets/testing-manifest.json`.
    - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`.
    - `packages/missing-routes/missing.json`.
    - `test/generated/http-contracts.json`.
    - `test/generated/suite-coverage.json`.

## Verification

- Orchestrator port note: the worker's unrelated `ChannelMessageCreateRoute.ts` annotation was not ported. Current integration `npm run build:src:tsgo` passed without that change.
- `npm run generate:schema`: passed, found 403 schemas and wrote 872 schema definitions.
- `npm run build:test-fixtures`: passed after current-base regeneration.
- Focused test command passed:
    - `NODE_OPTIONS=--preserve-symlinks node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/guilds/#guild_id/voice-states/#user_id/index.test.js'`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed.
    - Output included `Spacebar is missing 732`, `Spacebar implements 448`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed, wrote 553 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale.
- `npm run generate:contract-tests`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed after regeneration, 528 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially stale.
- `npm run generate:suite-coverage`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed after regeneration.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed.
- `npm run generate:openapi`: passed.
    - Sanity check: 356 OpenAPI paths, 872 schemas, route responses `200,400,401,403,404`, bearer security, `200` response schema `#/components/schemas/VoiceStateResponse`.
- `npx eslint 'src/api/routes/guilds/#guild_id/voice-states/#user_id/index.ts' 'src/api/routes/guilds/#guild_id/voice-states/#user_id/index.test.ts' 'src/schemas/responses/VoiceStateResponse.ts' 'src/schemas/responses/index.ts'`: passed.
- `npx prettier --check 'src/api/routes/guilds/#guild_id/voice-states/#user_id/index.ts' 'src/api/routes/guilds/#guild_id/voice-states/#user_id/index.test.ts' 'src/schemas/responses/VoiceStateResponse.ts' 'src/schemas/responses/index.ts' 'worker-progress/guilds-param-voice-states-param-get.md'`: passed.
- `git diff --check`: passed after final report update.
- Package manifest/lockfile cleanliness: `git diff -- package.json package-lock.json packages/*/package.json` produced no output.
- Malformed warranty-string scan: passed for changed files after final report update.

## Environment Notes

- The original worker worktree used an ignored local `node_modules` symlink to the main checkout. The current integration checkout used its existing local dependencies.

## Missing-Route Count Movement

- Worker launch-base regeneration: 735 -> 734 missing routes.
- Current integration regeneration: 733 -> 732 missing routes.
- Movement: `-1`.
- Removed owned entry: `GET_GUILDS_GUILD_ID_VOICE_STATES_USER_ID`.

## Risks And Follow-Ups

- Runtime `@me` requests can still match the dynamic Express segment, but this implementation intentionally does not map `@me` to the requester; the missing catalog still tracks current-user voice-state routes separately.
- Behavior depends on locally persisted `VoiceState` rows. If gateway/voice session persistence is incomplete elsewhere, this route correctly returns source-backed not-found behavior rather than inventing state.
- Recommended next tasks:
    - Implement `GET /guilds/{guild_id}/voice-states/@me` as its own scoped route.
    - Implement or audit current-user voice-state mutation separately from this read route.
