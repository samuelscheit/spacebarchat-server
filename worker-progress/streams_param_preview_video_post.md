# streams_param_preview_video_post

## Scope

- Assigned route: `POST /streams/{param}/preview/video`
- Assigned route name: `POST_STREAMS_STREAM_KEY_PREVIEW_VIDEO`
- Implemented only the assigned method-scoped route.
- Intentionally untouched sibling routes:
  - `POST /streams/{param}/notify`
  - `PATCH /streams/{param}/stream`

## Summary

- Added bearer-authenticated multipart preview video upload handling to `src/api/routes/streams/#stream_key/preview.ts`.
- Uses `createMessageUpload({ files: 1 }).single("file")` for the documented `file` form field.
- Requires the authenticated user to own the stream key before channel or stream lookup.
- Confirms a matching local voice-capable channel and active local `Stream` row.
- Uses an injectable `uploadPreviewVideo` dependency for real persistence.
- Fails closed with `501` by default because Spacebar has no durable local stream preview video storage provider or serving path yet.

## Evidence

- `packages/missing-routes/missing.json` listed `POST /streams/{param}/preview/video` as missing before this change.
- Userdoccers catalog lists `POST /streams/{stream_key}/preview/video`, route name `POST_STREAMS_STREAM_KEY_PREVIEW_VIDEO`, source `userdoccers:resources/voice.mdx`, summary `Upload Video Stream Preview`.
- Userdoccers public reference: `https://docs.discord.food/resources/voice`.
- The route is documented as a multipart form upload with a `file` field, owner-only access, and `204` success.
- Local xHyroM catalog has no `POST /streams/{param}/preview/video` entry.

## Changes

- `src/api/routes/streams/#stream_key/preview.ts`
- `test/routes/streams-param-preview-get.test.ts`
- Regenerated artifacts:
  - `assets/openapi.json`
  - `assets/testing-manifest.json`
  - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `packages/missing-routes/missing.json`
  - `test/generated/http-contracts.json`

## Behavior

- Missing `file` form field returns `400` before channel, permission, or stream lookup.
- Non-owner stream keys return the Discord unknown stream error before channel, permission, or stream lookup.
- Owned active streams call the configured `uploadPreviewVideo` dependency with stream key, channel, stream, user id, and Multer file metadata/buffer.
- Default production dependency returns `501` with `Stream preview video uploads are not supported`.
- No JSON request schema is declared because the current route metadata/OpenAPI generator models JSON request bodies, while this route is multipart.

## Missing-Route Movement

- `packages/missing-routes/missing.json`: `missing` changed `499 -> 498` on the current merge branch.
- `packages/missing-routes/missing.json`: `spacebar` changed `681 -> 682`.
- `packages/missing-routes/missing.json`: `discord` remains `1128`.
- Removed only missing entry `POST /streams/{param}/preview/video`.
- `POST /streams/{param}/notify` and `PATCH /streams/{param}/stream` remain missing and out of scope.

## Verification

All commands below passed unless noted under Known Failure.
All npm/node commands were run with `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`.

- `npm run build:src:tsgo`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/streams-param-preview-get.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run test:public-assets`
- `npx eslint 'src/api/routes/streams/#stream_key/preview.ts' test/routes/streams-param-preview-get.test.ts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json packages/*/package.json apps/*/package.json`

## Known Failure

- Full `npm run test:contracts` is expected to fail only on the known unrelated runtime contract `api:http:GET:/discovery/search`, which returns `500 !== 200`.

## Reconciliation Notes

- Replayed from isolated worker worktree `/Users/user/Developer/Developer/spacebarchat/worktrees/current-streams-param-preview-video-post-agent` onto current merge branch.
- Package manifests and lockfiles are unchanged.

## Risks / Blockers

- Durable preview video storage is absent. The default production dependency fails with `501` rather than discarding uploaded media and pretending it was persisted.
- The OpenAPI operation intentionally has no request body schema until the route metadata generator can represent multipart form uploads.
