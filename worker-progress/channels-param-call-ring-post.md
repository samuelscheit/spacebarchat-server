# channels-param-call-ring-post

## Summary

Implemented `POST /channels/{param}/call/ring` for the Spacebar API as `POST /channels/:channel_id/call/ring`.

The route is authenticated, loads the private channel with recipients, reuses the existing private-call eligibility rules, validates the optional nullable recipient body, checks for an active call through `VoiceState.count`, and returns source-backed conservative behavior:

- `204` when there is no active private call or the request targets no other recipients.
- `501` for active-call ringing that would require unsupported durable ringing state and `CALL_UPDATE` gateway emission.

## Changed Files

- `src/api/routes/channels/#channel_id/call.ts`
- `src/api/routes/channels/#channel_id/call.test.ts`
- `src/schemas/uncategorised/ChannelCallRingSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/channels-param-call-ring-post.md`

## Commands Run

- `test -L node_modules && printf 'node_modules symlink\n' || printf 'node_modules not symlink\n'`
- `test -d node_modules && printf 'node_modules present\n' || printf 'node_modules missing\n'`
- `npm ci`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `npm run generate:schema`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/channels/#channel_id/call.test.js'`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `git diff --check`
- Brief-required malformed AGPL warranty scan over changed route, schema, generated, and worker-progress files.
- Orchestrator current-base verification after porting to master `e7274d936`:
  - `npm run build:src:tsgo` - passed.
  - `npm run generate:schema` - passed, wrote `742` schemas.
  - `npm run build:test-fixtures` - passed.
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/channels/#channel_id/call.test.js'` - passed, `19` tests.
  - `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
  - `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
  - `npm run build --workspace @spacebar/missing-routes` - passed.
  - `npm run start --workspace @spacebar/missing-routes` - passed, reported `Spacebar is missing 803`, `Spacebar implements 377`, `Discord implements 1128`.
  - `npm run generate:testing-manifest` - passed, wrote `482` entries.
  - `node scripts/testing-manifest/verify.js` - passed.
  - `npm run generate:contract-tests` - passed, wrote `457` contracts.
  - `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
  - `npm run generate:suite-coverage` - passed, wrote `15` suites.
  - `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
  - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, `13` tests.
  - `npm run generate:openapi` - passed, generated `297` paths and `742` schemas with only the pre-existing webhook route-metadata warnings.
  - `git diff --check` - passed.
  - Lockfile/package-manifest diff guard - passed.
  - Brief-required malformed AGPL warranty scan over changed route, schema, generated, and worker-progress files - passed.
  - `jq` assigned-entry check confirmed `POST /channels/{param}/call/ring` has no remaining exact `missing_entries`; the adjacent `POST /channels/{param}/call/stop-ringing` remains.

Focused compiled route test result: 19 tests passed.

## Evidence Gathered

- Assigned missing entry existed before implementation in `packages/missing-routes/missing.json`: `POST /channels/{param}/call/ring`, route name `POST_CHANNELS_CHANNEL_ID_CALL_RING`, summary `Ring Channel Recipients`, source route `/channels/{channel_id}/call/ring`.
- The assigned route was absent before implementation from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`; only sibling `GET` and `PATCH /channels/{channel_id}/call` existed from `src/api/routes/channels/#channel_id/call.ts`.
- Existing local call route rules in `src/api/routes/channels/#channel_id/call.ts` restrict private calls to `DM` and `GROUP_DM`, require the caller to be a non-closed recipient, and use `VoiceState.count({ where: { channel_id } })` as the active-call signal.
- Userdoccers route catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `POST /channels/{channel_id}/call/ring` from `userdoccers:resources/channel.mdx`.
- xHyroM route catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `OPTIONS` and `POST /channels/{channel_id}/call/ring` with route name `CALL_RING`.
- Userdoccers `resources/channel.mdx` at commit `259d8f8cf97ff357c4d1255afdf30e2e05672742` documents the endpoint as OAuth2 voice-capable, request body `recipients?: ?array[snowflake]` defaulting to all, `204` success, requires an active call to do anything, and fires `Call Update`.
- Spacebar has no durable private-call ringing state and no `CALL_UPDATE` gateway event implementation found locally, so active-call ringing fails closed with `501` instead of fabricating recipients, call state, or gateway events.

References:

- Userdoccers raw MDX: https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/259d8f8cf97ff357c4d1255afdf30e2e05672742/pages/resources/channel.mdx
- Userdoccers rendered docs: https://docs.discord.food/resources/channel
- xHyroM local catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`

## Route Scope

- Assigned path: `/channels/{param}/call/ring`
- Missing methods found: `POST`
- Methods implemented: `POST`
- Adjacent paths intentionally not implemented: `/channels/{param}/call/stop-ringing`, `/channels/{param}/call`, voice-state routes, DM recipient management, guild voice routes, unrelated channel endpoints.

## What Changed

- Added `router.post("/ring", ...)` under the existing channel call router.
- Added `ChannelCallRingSchema` with optional nullable `recipients?: Snowflake[] | null`.
- Added response metadata for `204`, `400`, `401`, `403`, `404`, and `501`.
- Added focused tests for metadata, schema validation, no-active-call no-op, active-call fail-closed behavior, no-target no-op, channel type rejection, inactive requester rejection, and recipient authorization.
- Regenerated source route catalog, missing-route report, schemas, testing manifest, generated HTTP contract metadata, suite coverage, and OpenAPI.

## Missing-Route Movement

- Before: `missing = 809`, `spacebar = 371`
- After: `missing = 808`, `spacebar = 372`
- Current-base before integration: `missing = 804`, `spacebar = 376`
- Current-base after regeneration: `missing = 803`, `spacebar = 377`
- Assigned entry after regeneration: no remaining `missing_entries[]` item for `/channels/{param}/call/ring`.

## Risks And Blockers

- Active-call ringing is not fully Discord-compatible yet because Spacebar lacks durable private-call ringing state and `CALL_UPDATE` gateway support.
- Current behavior is intentionally conservative: active-call ringing returns `501` rather than pretending to ring recipients.
- `POST /channels/{param}/call/stop-ringing` remains unimplemented by assignment scope.

## Recommended Next Tasks

- Add a durable private-call/call-ringing model if Spacebar wants full Discord-compatible ringing state.
- Add `CALL_UPDATE` gateway event support and contract tests around private-call ring/stop-ringing transitions.
- Implement the adjacent `POST /channels/{param}/call/stop-ringing` route after the state/event model exists.

## Goal Status Evidence

- Initial `create_goal` objective: `implement the missing route path \`POST /channels/{param}/call/ring\` for the Spacebar server API`
- Initial `get_goal` evidence: status `active`, same objective.
- Final pre-completion `get_goal` evidence: status `active`, same objective, thread `019e1247-4b83-75a3-8225-fc95322a0cd4`.
