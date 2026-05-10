<!--
Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
Copyright (C) 2023 Spacebar and Spacebar Contributors

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

# `/checkpoint` Worker Handoff

## Goal Evidence

- Setup goal status: active
- Setup objective: Implement production-ready support for the assigned missing route path `/checkpoint` on this worker branch, including all missing methods for that exact path, focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- Worker goal was marked complete after the handoff report and worker verification finished.

## Summary

- Assigned path: `/checkpoint`
- Missing methods found: `GET /checkpoint` (`GET_CHECKPOINT`, summary `Get Checkpoint`)
- Methods implemented: `GET /checkpoint`
- Scope boundaries respected: no `/checkpoint/loot`, auth, MFA, account-verification, login, or safety-hub route work.
- Missing-route movement on accepted current base: `790` missing / `390` implemented before; `789` missing / `391` implemented after regeneration.

## Source Evidence

- Local missing report before implementation: `packages/missing-routes/missing.json` had exactly one `missing_entries[]` item for route `/checkpoint`.
- Local source catalog before implementation: `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `/checkpoint` entry.
- Local route tree before implementation: `src/api/routes/checkpoint.ts` was absent.
- Userdoccers source: `https://github.com/discord-userdoccers/discord-userdoccers/blob/master/pages/resources/checkpoint.mdx`
  - Documents `Get Checkpoint` as retrieving the user's current yearly checkpoint.
  - Documents no request body or query parameters.
  - Documents a checkpoint response with optional stats sections and an avatar decoration collectible item.
  - Documents adjacent `Claim Checkpoint Avatar Decoration` behavior separately; this worker did not implement `/checkpoint/loot`.

## Behavior

- Route metadata declares summary `Get Checkpoint`, `200: CheckpointResponse`, and authenticated `401: APIErrorResponse`.
- Runtime response is bearer-authenticated through the existing API auth boundary.
- The response uses backed Spacebar data for the safe current-year fields Spacebar can support now:
  - `messages.num_messages_sent`: count of current user's messages in the current UTC year.
  - `guilds.num_guilds_joined`: count of current user's guild memberships joined in the current UTC year.
- The route returns `avatar_decoration: null` instead of fabricating a free collectible because Spacebar does not currently have a persisted checkpoint collectible/reward catalog.
- Discord-specific stats without current Spacebar backing, such as percentile ranking, voice duration history, game sessions, sidekick users, quest orbs, and top emoji usage, are left absent or nullable rather than invented.
- No gateway events, audit logs, or persistence mutations are emitted by `GET /checkpoint`.

## Changed Files

- `src/api/routes/checkpoint.ts`
- `src/api/routes/checkpoint.test.ts`
- `src/schemas/responses/CheckpointResponse.ts`
- `src/schemas/responses/CheckpointResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `worker-progress/checkpoint-get.md`

## Generated Evidence

- Source catalog now includes:
  - `GET /checkpoint`
  - route name `GET_CHECKPOINT`
  - response schema refs `APIErrorResponse`, `CheckpointResponse`
  - source `src/api/routes/checkpoint.ts`
- `packages/missing-routes/missing.json` no longer has a `/checkpoint` missing entry.
- Testing manifest now has `api:http:GET:/checkpoint/` with bearer auth and response statuses `200`, `401`.
- Generated HTTP contracts now include `/checkpoint/`.
- OpenAPI now has `/checkpoint/` with `CheckpointResponse` for `200` and `APIErrorResponse` for `401`.

## Commands Run

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; schema output contains 780 schemas.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/checkpoint.test.js dist-test/src/schemas/responses/CheckpointResponse.test.js` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote `missing.json` with `789` missing / `391` implemented.
- `npm run generate:testing-manifest` - passed; 496 entries.
- `node scripts/testing-manifest/verify.js` - passed; 496 entries.
- `npm run generate:contract-tests` - passed; 471 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed; 471 contracts.
- `npm run generate:suite-coverage` - passed; 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed; 13 tests.
- `npm run generate:openapi` - passed and wrote 310 paths / 780 schemas.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed after OpenAPI generation.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed after OpenAPI generation.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock --exit-code` - passed.
- Changed-file malformed warranty scan from the worker brief passed.

## Verification Result

- Focused compiled route/schema tests: pass, 5 tests.
- Generated HTTP contract and suite coverage tests: pass, 13 tests.
- Testing manifest verification: pass, 496 entries.
- Generated HTTP contract check: pass, 471 contracts.
- Suite coverage check: pass, 15 suites.
- Missing-route regeneration: pass, `Spacebar is missing 789`, `Spacebar implements 391`.
- OpenAPI generation: pass, 310 paths and 780 schemas. Existing unrelated warnings remain for webhook routes without `route()` metadata.
- `git diff --check`: pass.
- Package manager file diff check: pass.
- Malformed warranty scan: pass.

## Risks And Blockers

- Spacebar currently has no durable checkpoint recap model or collectible reward catalog, so the route cannot truthfully return or grant the Discord checkpoint avatar decoration. It returns `avatar_decoration: null` and avoids mutation.
- Spacebar currently lacks historical voice duration, game session, quest orb, percentile, and sidekick aggregation models for full Discord parity. The schema supports these fields, but this implementation only returns backed message and guild-join counts.

## Recommended Next Tasks

- Implement `/checkpoint/loot` only when separately assigned and only after a durable collectible reward model exists.
- Add a dedicated checkpoint aggregation service if Spacebar wants full yearly recap parity.
- Add persisted voice/game/quest activity histories before filling those optional checkpoint sections.
