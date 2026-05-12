# GET /streams/{param}/preview

## Worker

- Stable worker id: `streams_param_preview_get`
- Branch: `codex/current-missing-route-streams-param-preview-get-agent`
- Worktree: `/Users/user/Developer/Developer/spacebarchat/worktrees/current-streams-param-preview-get-agent`
- Assigned integration base: `eb12dfc5b Implement guild new member actions route`

## Changed Files

- `src/api/routes/streams/#stream_key/preview.ts`
- `test/routes/streams-param-preview-get.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/streams-param-preview-get.md`

## Evidence Sources

- `packages/missing-routes/missing.json` listed `GET /streams/{param}/preview` as missing before this worker change.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` has `GET /streams/{stream_key}/preview`, route name `GET_STREAMS_STREAM_KEY_PREVIEW`, source `userdoccers:resources/voice.mdx`, summary `Get Stream Preview`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` has `GET /streams/{param}/preview`, route name `STREAM_PREVIEW`, source `xhyrom:data/client/routes.json`.
- Local stream backing is limited to `Stream` and `StreamSession` records plus gateway stream create/watch/delete flow. No durable stream preview image or video metadata source was found.

## Behavior

- Adds only `GET /streams/:stream_key/preview/`.
- Parses local `guild:{guild_id}:{channel_id}:{user_id}` and `call:{channel_id}:{user_id}` stream keys.
- Resolves the target channel, requires it to be voice-capable, requires guild/call key consistency, enforces authenticated `CONNECT` access, and verifies an active `Stream` row for the target channel and owner.
- Returns `204 No Content` for an accessible active stream because Spacebar has no local persisted preview media source to return.
- Returns `404` with Discord unknown stream code `10049` for malformed keys, mismatched channel/key pairs, missing channels, unsupported channel types, and absent stream records.
- Returns `403` when the authenticated user lacks `CONNECT`.

## Adjacent Routes Intentionally Untouched

- `POST /streams/{param}/notify`
- `POST /streams/{param}/preview`
- `POST /streams/{param}/preview/video`
- `PATCH /streams/{param}/stream`
- Voice-state mutation, stage-instance, channel call, RTC/WebRTC, media proxy, and unrelated guild/channel routes.

## Missing-Route Movement

- `packages/missing-routes/missing.json`: `missing` changed `584 -> 583`.
- `packages/missing-routes/missing.json`: `spacebar` changed `596 -> 597`.
- Removed only missing entry `GET /streams/{param}/preview`.
- `POST /streams/{param}/preview`, `POST /streams/{param}/preview/video`, `POST /streams/{param}/notify`, and `PATCH /streams/{param}/stream` remain missing.

## Verification

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/missing-routes/dist/cli.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/streams-param-preview-get.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js test/contracts/*.test.cjs`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test --workspace @spacebar/missing-routes`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json packages/*/package.json apps/*/package.json`

## Risks

- This does not return Discord preview media because no local durable stream preview storage exists. Clients that expect an image or video preview body will receive `204` for readable active streams until a real preview persistence path exists.
- REST authorization is intentionally stricter than simple channel visibility: the requester must have `CONNECT`, matching gateway stream-watch access.

## Reconciliation

- No merge/rebase/reconciliation was performed in this worker. Reconcile during integration if main has advanced beyond assigned base `eb12dfc5b`.

## Integration Acceptance

- Accepted on current integration base `35f4f386c650a9a961844893a509410359e8218e`.
- Ported only the worker-owned stream preview route, focused route test, and this progress report; regenerated shared artifacts on the current base.
- Tightened stream-key parsing during integration so guild and call stream keys must have exactly the documented segment counts.
- Current-base missing-route movement: `missing` 582 -> 581, `spacebar` 598 -> 599, `discord` 1128 unchanged.
- `GET /streams/{param}/preview` is removed from `missing_entries`; `POST /streams/{param}/preview`, `POST /streams/{param}/preview/video`, `POST /streams/{param}/notify`, and `PATCH /streams/{param}/stream` remain missing and out of scope.
- Verification passed on current base:
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/streams-param-preview-get.test.js`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js test/contracts/*.test.cjs`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test --workspace @spacebar/missing-routes`
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run lint`
  - `git diff --check`
  - package and lockfile guard
- Full `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` failed only on the known unrelated runtime contract `api:http:GET:/discovery/search` returning `500 !== 200`; existing analytics `query` route-registration warnings also appeared.
