# games-param-announcements-get

Goal status at orchestrator acceptance: complete.

Goal objective: Implement production-ready GET support for `/games/{game_id}/announcements` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.

## Summary

Implemented `GET /games/{game_id}/announcements` only.

The route reads `Application.announcements_channel_id`, validates the configured channel is a linked guild news channel, requires `VIEW_CHANNEL`, returns an empty message list when `READ_MESSAGE_HISTORY` is missing, and serializes announcement messages through the same public message hydration/signing helpers used by channel history.

## Assigned Route

- Assigned path: `/games/{game_id}/announcements`
- Missing methods found: `GET`
- Implemented methods: `GET`
- Missing entry removed: `GET /games/{param}/announcements`
- Current-base missing-route movement: `missing` `802 -> 801`; `spacebar` `378 -> 379`

## References

- Userdoccers route source: `userdoccers:resources/game.mdx`
- Docs mirror used by worker: `https://docs.discord.food/resources/game#get-game-announcements`
- Relevant source facts: game data has `announcements_channel_id`; route is `GET /games/{game.id}/announcements`; query `limit` is integer 1-50 default 50; response body has optional `guild_id`, optional `channel_id`, and `messages`.
- xHyroM local catalog: no matching `/games/{game_id}/announcements` entry found.

## Changed Files

- `src/api/routes/games/#game_id/announcements.ts`
- `src/util/entities/Application.ts`
- `src/util/migration/postgres/1778422200000-ApplicationAnnouncementsChannel.ts`
- `src/schemas/responses/GameAnnouncementsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/games-announcements.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/games-param-announcements-get.md`

## Verification

- `npm run build:src:tsgo` passed.
- `npm run generate:schema` passed and emitted `GameAnnouncementsResponse`.
- `npm run build:test-fixtures` passed.
- Focused compiled route test passed: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/games-announcements.test.js` with 8/8 tests passing.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed: `Spacebar is missing 801`.
- `npm run generate:testing-manifest` passed: 484 entries.
- `node scripts/testing-manifest/verify.js` passed: 484 entries.
- `npm run generate:contract-tests` passed: 459 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` passed: 459 contracts.
- `npm run generate:suite-coverage` passed: 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: 13/13 tests.
- `npm run generate:openapi` passed and wrote 299 paths / 744 schemas; the generator still reports existing unrelated webhook route metadata warnings.

## Artifact Evidence

- Source catalog contains `GET_GAMES_GAME_ID_ANNOUNCEMENTS` at `/games/{game_id}/announcements`, sourced from `src/api/routes/games/#game_id/announcements.ts`.
- Missing-route report no longer contains `/games/{param}/announcements`.
- `assets/testing-manifest.json` contains `api:http:GET:/games/:game_id/announcements/` with `authMode: "bearer"`, response bodies `APIErrorResponse` and `GameAnnouncementsResponse`, and statuses `200`, `401`, `403`, `404`, and `422`.
- `assets/openapi.json` contains `GET /games/{game_id}/announcements/` with bearer security and responses `200`, `401`, `403`, `404`, and `422`.
- `assets/schemas.json` contains `GameAnnouncementsResponse` with required `messages` and optional `guild_id` / `channel_id`.
- `test/generated/http-contracts.json` contains `api:http:GET:/games/:game_id/announcements/`.

## Risks And Blockers

- No route-scoped verification blockers remain.
- This route depends on future/admin/game-claim behavior populating `Application.announcements_channel_id`; when absent or invalid, it returns `{ "messages": [] }`.

## Prompt-To-Artifact Audit

- Derived current `missing_entries[]` for `/games/{param}/announcements`: complete, one `GET` entry.
- Confirmed absence before implementation: complete, source catalog had only `/games/detectable` under games.
- Compared Userdoccers/xHyroM references: complete.
- Implemented production behavior and focused tests: complete.
- Added explicit authenticated-route `401: { body: "APIErrorResponse" }` response metadata: complete.
- Added AGPL headers to new source, schema, migration, test, and report files where applicable: complete.
- Regenerated source route catalog: complete.
- Regenerated missing-route report on current base: complete.
- Regenerated schemas, testing manifest, generated HTTP contracts, suite coverage, and OpenAPI: complete.
- Verified focused tests and generated static contract/suite tests: complete.
