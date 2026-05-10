# GET /channels/{channel_id}/directory-entry/{entity_id}

## Summary

Implemented the assigned authenticated `GET /channels/{channel_id}/directory-entry/{entity_id}` route. The route advertises the documented `HubDirectoryEntry` success schema, includes `401`, `403`, and `404` `APIErrorResponse` metadata, enforces `VIEW_CHANNEL`, and returns a conservative `404` because Spacebar does not currently persist directory entries.

## Changed Files

- `src/api/routes/channels/#channel_id/directory-entry.ts`
- `test/scenarios/channels-supplemental.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/channels-param-directory-entry-param-get.md`

## Assigned Path

- Assigned route path: `/channels/{channel_id}/directory-entry/{entity_id}`
- Normalized missing route path: `/channels/{param}/directory-entry/{param}`
- Assigned method implemented: `GET`

## Missing Methods Found

Initial `packages/missing-routes/missing.json` contained four `missing_entries[]` items for the exact assigned route:

- `DELETE /channels/{param}/directory-entry/{param}`
- `GET /channels/{param}/directory-entry/{param}`
- `PATCH /channels/{param}/directory-entry/{param}`
- `POST /channels/{param}/directory-entry/{param}`

The assignment objective was specifically `GET /channels/{channel_id}/directory-entry/{entity_id}`. The mutating methods require directory-entry persistence, `MANAGE_GUILD` checks on the entity, and gateway create/update/delete events, so they were left for a separate mutating-route task rather than stubbed unsafely.

## What Changed

- Added `src/api/routes/channels/#channel_id/directory-entry.ts`.
- Enforced bearer auth through the normal API stack and `VIEW_CHANNEL` with `getPermission`.
- Added response metadata:
  - `200: HubDirectoryEntry`
  - `401: APIErrorResponse`
  - `403: APIErrorResponse`
  - `404: APIErrorResponse`
- Returned `404 Directory entry not found` after permission checks because there is no Spacebar directory-entry backing table/model.
- Added scenario coverage for the new manifest id in `test/scenarios/channels-supplemental.test.ts`.
- Regenerated route source catalog, missing-route report, schemas, testing manifest, HTTP contract catalog, suite coverage, and OpenAPI. Schema generation produced no `assets/schemas.json` diff.

## Missing-Route Movement

- Before regeneration: `Spacebar is missing 847`.
- After regeneration: `Spacebar is missing 846`.
- The assigned `GET_CHANNELS_CHANNEL_ID_DIRECTORY_ENTRY_ENTITY_ID` entry disappeared.
- Remaining exact-path missing methods: `DELETE`, `PATCH`, `POST`.

## Evidence Gathered

- Confirmed the assigned path was absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` before implementation.
- Confirmed there was no exact `src/api/routes/**` route for `/channels/{channel_id}/directory-entry/{entity_id}` before implementation.
- Existing local route `src/api/routes/channels/#channel_id/directory-entries.ts` returns an empty `HubDirectoryEntriesResponse`, showing Spacebar currently lacks directory-entry state.
- Existing schema `src/schemas/responses/HubDirectoryEntriesResponse.ts` already defines `HubDirectoryEntry`, so no new schema type was needed.
- Regenerated source catalog now contains `GET /channels/{channel_id}/directory-entry/{entity_id}` from `src/api/routes/channels/#channel_id/directory-entry.ts`.

## Userdoccers And xHyroM References

- Local Userdoccers catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
  - `GET_CHANNELS_CHANNEL_ID_DIRECTORY_ENTRY_ENTITY_ID`
  - source `userdoccers:resources/directory-entry.mdx`
  - route `/channels/{channel_id}/directory-entry/{entity_id}`
- Local xHyroM catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  - route `/channels/{channel_id}/directory-entry/{param}`
  - `GET` method under `DIRECTORY_CHANNEL_ENTRY`
- Upstream Userdoccers source:
  - `https://github.com/discord-userdoccers/discord-userdoccers/blob/master/pages/resources/directory-entry.mdx`
  - Documents `Get Directory Entry` as returning a directory entry object and requiring `VIEW_CHANNEL`.
  - Documents create/update/delete as mutating routes requiring `MANAGE_GUILD` on the entity and gateway events.

## Commands Run

- `if [ -L node_modules ]; then unlink node_modules; fi`
- `if [ ! -d node_modules ]; then npm ci; fi`
- `npx prettier --write src/api/routes/channels/#channel_id/directory-entry.ts test/scenarios/channels-supplemental.test.ts`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node --test dist-test/test/scenarios/channels-supplemental.test.js` failed because direct Node execution does not load `module-alias/register`.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test --test-concurrency=1 dist-test/test/scenarios/channels-supplemental.test.js` passed with the scenario skipped due missing Postgres admin fixture.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/generate-contract-tests.js`
- `node scripts/testing-manifest/generate-suite-coverage.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`

## Risks And Blockers

- Spacebar has no durable directory-entry state, so `GET` cannot return real directory entry objects yet.
- The route deliberately returns `404` instead of synthesizing entries from guild existence, because a guild existing does not prove it was added to a directory channel.
- The remaining `POST`, `PATCH`, and `DELETE` methods should not be implemented as stubs; they need persistence, entity ownership/`MANAGE_GUILD` checks, and gateway event behavior.

## Recommended Next Tasks

- Design and add a directory-entry persistence model.
- Implement `POST`, `PATCH`, and `DELETE` for the same path after persistence exists.
- Implement list/count/search routes against the same backing state in separate assigned workers.
- Extend scenario coverage to assert successful `200 HubDirectoryEntry` responses once entries can be created.

## Goal Status Evidence

- `create_goal` objective: `implement the missing route path GET /channels/{channel_id}/directory-entry/{entity_id} for the Spacebar server API.`
- `get_goal` status after setup and before final verification: `active`.
- `get_goal` objective matched the assigned `GET /channels/{channel_id}/directory-entry/{entity_id}` route.
