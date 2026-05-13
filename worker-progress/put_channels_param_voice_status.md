# Worker Progress: PUT /channels/{param}/voice-status

## Summary

Implemented only the assigned `PUT /channels/{param}/voice-status` route as `PUT /channels/:channel_id/voice-status`.

The route accepts a required nullable `status` value, uses non-coercing request validation, declares `SET_VOICE_CHANNEL_STATUS` route metadata, allows currently connected voice-channel users to update without `MANAGE_CHANNELS`, requires `MANAGE_CHANNELS` for disconnected users, persists `channel.status`, and emits `VOICE_CHANNEL_STATUS_UPDATE`.

## Assigned Scope

- Assigned path: `/channels/{param}/voice-status`
- Source route: `/channels/{channel_id}/voice-status`
- Assigned method: `PUT`
- Assigned route name: `PUT_CHANNELS_CHANNEL_ID_VOICE_STATUS`
- Implemented method: `PUT`
- Intentionally untouched sibling routes: `OPTIONS /channels/{channel_id}/voice-status`, `/channels/{channel_id}/voice-channel-effects`, and other adjacent channel routes.

## Changed Files

- `src/api/routes/channels/#channel_id/voice-status.ts`
- `src/api/routes/channels/#channel_id/voice-status.test.ts`
- `src/schemas/uncategorised/VoiceChannelStatusModifySchema.ts`
- `src/schemas/uncategorised/index.ts`
- `src/util/interfaces/Event.ts`
- `src/util/interfaces/Event.test.ts`
- `src/util/util/Intents.ts`
- `src/util/util/Intents.test.ts`
- `src/gateway/listener/listener.ts`
- `src/gateway/listener/listener.test.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/put_channels_param_voice_status.md`

## What Changed

- Added `VoiceChannelStatusModifySchema` with required `status: string | null` and `maxLength: 500`.
- Added non-coercing request-body validation for the new route.
- Added route metadata for `SET_VOICE_CHANNEL_STATUS`, `VOICE_CHANNEL_STATUS_UPDATE`, `204`, and API error responses.
- Limited execution to `GUILD_VOICE` channels; non-voice channels return `CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE`.
- Checked `VoiceState.count({ channel_id, user_id })` so connected users can update without `MANAGE_CHANNELS`.
- Required `MANAGE_CHANNELS` for disconnected users.
- Persisted `channel.status` and emitted `VOICE_CHANNEL_STATUS_UPDATE` with `{ id, guild_id, status }`.
- Added gateway event typings, enum/name registration, intent classification under `GUILD_VOICE_STATES`, and channel visibility gating.
- Added focused tests for route metadata, schema validation, connected/disconnected permission behavior, clear-status behavior, non-voice rejection, event declarations, intent classification, and listener event-map coverage.
- Regenerated schema, OpenAPI, source route catalog, missing-route report, testing manifest, generated HTTP contracts, and suite coverage.

## Evidence Gathered

- `packages/missing-routes/missing.json` listed `PUT /channels/{param}/voice-status` with `route_name: PUT_CHANNELS_CHANNEL_ID_VOICE_STATUS`.
- Before implementation, `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `/channels/{channel_id}/voice-status` source route.
- Local Userdoccers catalog listed `PUT /channels/{channel_id}/voice-status` from `userdoccers:resources/channel.mdx` with summary `Modify Channel Status`.
- Local xHyroM catalog listed `PUT /channels/{channel_id}/voice-status` with route name `UPDATE_VOICE_CHANNEL_STATUS`.
- Existing gateway evidence included received `VOICE_CHANNEL_STATUS_UPDATE` payloads shaped as `{ guild_id, id, status }`.
- After regeneration, the source catalog contains `PUT_CHANNELS_CHANNEL_ID_VOICE_STATUS` from `src/api/routes/channels/#channel_id/voice-status.ts`.

## Missing-Route Count Movement

- Before regeneration on the accepted integration base: `479` missing, `701` implemented, `1128` Discord.
- After regeneration on the accepted integration base: `478` missing, `702` implemented, `1128` Discord.
- The missing entry for `PUT /channels/{param}/voice-status` was removed.

## Commands Run

- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npx prettier --write src/api/routes/channels/#channel_id/voice-status.ts src/api/routes/channels/#channel_id/voice-status.test.ts src/schemas/uncategorised/VoiceChannelStatusModifySchema.ts src/schemas/uncategorised/index.ts src/util/interfaces/Event.ts src/util/interfaces/Event.test.ts src/util/util/Intents.ts src/util/util/Intents.test.ts src/gateway/listener/listener.ts src/gateway/listener/listener.test.ts tsconfig.test.json assets/schemas.json assets/openapi.json assets/testing-manifest.json packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json packages/missing-routes/missing.json test/generated/http-contracts.json test/generated/suite-coverage.json worker-progress/put_channels_param_voice_status.md`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/channels/#channel_id/voice-status.test.js' dist-test/src/util/interfaces/Event.test.js dist-test/src/util/util/Intents.test.js dist-test/src/gateway/listener/listener.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx eslint src/api/routes/channels/#channel_id/voice-status.ts src/api/routes/channels/#channel_id/voice-status.test.ts src/schemas/uncategorised/VoiceChannelStatusModifySchema.ts src/schemas/uncategorised/index.ts src/util/interfaces/Event.ts src/util/interfaces/Event.test.ts src/util/util/Intents.ts src/util/util/Intents.test.ts src/gateway/listener/listener.ts src/gateway/listener/listener.test.ts`
- `git diff --check`
- `git status --short package.json package-lock.json`
- `git diff -- package.json package-lock.json`
- `npm run test:contracts`

## Current Verification Results

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote `1235` schemas.
- `npm run generate:openapi`: passed; specification contains `567` paths and `1235` schemas, with only pre-existing webhook route-metadata warnings.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `import-source-routes`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed with `478` missing and `702` implemented.
- `npm run generate:testing-manifest`: passed; `807` entries.
- `npm run generate:contract-tests`: passed; `782` contracts.
- `npm run generate:suite-coverage`: passed; `15` suites.
- Prettier formatting: passed.
- `npm run build:test-fixtures`: passed.
- Focused compiled tests for the route plus Event, Intents, and listener coverage: passed (`73` tests).
- `npm run test:manifest`: passed (`807` entries).
- `npm run test:suite-coverage`: passed.
- Targeted ESLint: passed.
- `git diff --check`: passed.
- Package/lockfile guard: passed; `package.json` and `package-lock.json` unchanged.
- `npm run test:contracts`: generated/static contract checks passed, runtime failed only on the known unrelated `api:http:GET:/discovery/search` response-schema assertion (`500 !== 200`), matching the orchestrator note.

## Risks / Blockers

- No blocker remains for this assigned route.
- The full generated contract runtime suite still has the known unrelated `/discovery/search` failure.
- Existing analytics query route registration warnings remain unrelated to this change.

## Recommended Next Tasks

- Keep `/channels/{param}/voice-channel-effects` and any `OPTIONS` handling assigned to separate workers.
- Investigate the unrelated `/discovery/search` runtime contract failure outside this worker.
- Clean up the pre-existing analytics query route registration warnings separately.
