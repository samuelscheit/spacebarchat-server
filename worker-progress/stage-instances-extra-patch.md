# stage-instances-extra-patch

## Summary

Implemented only `PATCH /stage-instances/extra` for assigned xHyroM route name `STAGE_INSTANCES_EXTRA`.

The endpoint is bearer-authenticated and fails closed with `501 APIErrorResponse`. Spacebar currently persists normal `StageInstance` records and exposes those through the existing GET extra projection; it does not have a durable local model for Discord provider-backed extra stage metadata, discovery, participant, voice-state, or scheduled-event mutation state. The PATCH route therefore does not mutate `StageInstance`, `Channel`, `VoiceState`, or scheduled event state.

## Changed Files

- `src/api/routes/stage-instances/extra.ts`
- `src/api/routes/stage-instances/extra.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/stage-instances-extra-patch.md`

## Missing-Route Movement

- Worker-base regeneration: `missing: 535` -> `534`, `spacebar: 645` -> `646`, `discord: 1128`.
- Integration regeneration after the latest accepted main checkout: `missing: 534` -> `533`, `spacebar: 646` -> `647`, `discord: 1128`.
- `PATCH /stage-instances/extra` was removed from `packages/missing-routes/missing.json`.
- `DELETE /stage-instances/extra` remains missing and was intentionally left untouched because this worker was assigned only PATCH.
- Source route catalog now includes `PATCH /stage-instances/extra` with generated source route name `PATCH_STAGE_INSTANCES_EXTRA`. The xHyroM assigned route name remains `STAGE_INSTANCES_EXTRA`.

## Evidence Sources

- `packages/missing-routes/missing.json`: assigned path had missing `DELETE` and `PATCH` entries; PATCH matched assigned route name `STAGE_INSTANCES_EXTRA`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: initially had only local `GET /stage-instances/extra`; after regeneration includes GET and PATCH, not DELETE.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`: xHyroM lists `DELETE`, `GET`, `HEAD`, `OPTIONS`, and `PATCH` for `/stage-instances/extra`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`: no matching `/stage-instances/extra` entry found locally.
- `src/api/routes/stage-instances/extra.ts`: existing GET behavior returns the authenticated user's visible persisted stage instances.
- `src/api/util/handlers/StageInstance.ts`, `src/util/entities/StageInstance.ts`, `src/schemas/responses/StageInstanceResponse.ts`, `src/schemas/uncategorised/StageInstanceModifySchema.ts`: local durable model covers normal stage instances and channel-scoped privacy modification only, not extra provider metadata mutation.
- `src/api/routes/stage-instances/index.ts` and `src/api/routes/stage-instances/#channel_id/index.ts`: normal create/get/patch/delete stage instance routes remain channel-scoped and permission guarded.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx prettier --write src/api/routes/stage-instances/extra.ts src/api/routes/stage-instances/extra.test.ts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` failed initially because `node_modules` was absent and `tsgo` was not installed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/stage-instances/extra.test.js dist-test/src/api/util/handlers/StageInstance.test.js dist-test/src/schemas/responses/StageInstanceResponse.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` failed only on known unrelated `api:http:GET:/discovery/search` runtime assertion `500 !== 200`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/routes/stage-instances/extra.ts src/api/routes/stage-instances/extra.test.ts`
- `git diff --check`
- `git diff -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json`

## Verification Results

- Focused stage instance route/handler/schema tests passed: 21 tests.
- `npm run build:src:tsgo` passed after `npm ci`.
- `npm run build:test-fixtures` passed.
- Automatic reverse engineering workspace build passed.
- Missing routes workspace build passed.
- Testing manifest check passed: 752 entries.
- Suite coverage check passed.
- Generated contract checks passed before runtime.
- Runtime contracts failed only for known unrelated `api:http:GET:/discovery/search` returning `500 !== 200`.
- Targeted ESLint passed for touched route/test files.
- `git diff --check` passed.
- Package/lockfile guard passed with no diff for package manifests or lockfile.

## Risks And Blockers

- Discord PATCH request schema and successful mutation semantics are not present in local xHyroM/Userdoccers evidence.
- Spacebar does not currently persist provider-backed stage extra metadata. A successful PATCH would risk corrupting normal stage instances, channel metadata, voice state, or scheduled event state with unrelated client-only fields.
- PATCH therefore returns 501 until a real durable extra-stage metadata model exists.

## Adjacent Routes Untouched

- `GET /stage-instances/extra` remains the local read-only visible-stage projection.
- `DELETE /stage-instances/extra` remains missing.
- Normal channel-scoped stage instance POST/GET/PATCH/DELETE routes are unchanged.
- Voice state, scheduled event/stage event, channel permission, and unrelated channel routes were not implemented or changed.

## Reconciliation Notes

- Generated `test/generated/suite-coverage.json` was refreshed and remained unchanged, so it is not in the final diff.
- `assets/schemas.json` was regenerated and remained unchanged because this implementation adds no new schema type.
- `npm ci` was required because the assigned worktree had no `node_modules`; it did not modify package manifests or lockfile.

## Recommended Next Tasks

- Assign `DELETE /stage-instances/extra` separately if the orchestrator wants the sibling method handled.
- Add a real provider-backed stage extra metadata model before implementing successful mutations for this path.
- Investigate the existing unrelated runtime contract failure for `GET /discovery/search`.
