# streams_param_preview_post

## Scope

- Assigned route: `POST /streams/{param}/preview`
- Assigned route name: `POST_STREAMS_STREAM_KEY_PREVIEW`
- Implemented only the assigned method-scoped route.
- Intentionally untouched sibling routes:
  - `PATCH /streams/{param}/stream`
  - `POST /streams/{param}/notify`
  - `POST /streams/{param}/preview/video`

## Summary

- Added bearer-authenticated preview upload handling to `src/api/routes/streams/#stream_key/preview.ts`.
- Added `StreamPreviewUploadSchema` with required `thumbnail` image data.
- Validates documented `guild:{guild_id}:{channel_id}:{user_id}` and `call:{channel_id}:{user_id}` stream keys.
- Requires the authenticated user to own the stream key before channel or stream lookup.
- Confirms a matching local voice-capable channel and active local `Stream` row.
- Uses an injectable `uploadPreview` dependency for real persistence.
- Fails closed with `501` by default because Spacebar has no durable stream-preview storage provider or CDN serving path yet.

## Evidence

- Userdoccers documents `POST /streams/{stream_key}/preview`, JSON `thumbnail` image data, owner requirement, and `204` success: `https://docs.discord.food/resources/voice`.
- Local Userdoccers catalog lists `POST /streams/{stream_key}/preview` with summary `Upload Stream Preview`.
- Local xHyroM catalog lists `POST /streams/{param}/preview` / `STREAM_PREVIEW`.

## Changes

- `src/api/routes/streams/#stream_key/preview.ts`
- `src/schemas/uncategorised/StreamPreviewUploadSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `src/schemas/Validator.test.ts`
- `test/routes/streams-param-preview-get.test.ts`
- Regenerated artifacts after reconciliation:
  - `assets/schemas.json`
  - `assets/openapi.json`
  - `assets/testing-manifest.json`
  - `test/generated/http-contracts.json`
  - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `packages/missing-routes/missing.json`

## Verification

- Worker verification passed build, focused route/schema tests, manifest, suite coverage, targeted ESLint, `git diff --check`, and package/lockfile guard.
- Main-checkout reconciliation regenerated artifacts on top of `60f56509f`.
- Main-checkout missing-route movement: `510 -> 509`; implemented routes `670 -> 671`; Discord routes `1128`.
- Main-checkout focused verification passed source build, schema/OpenAPI generation, source catalog import, missing-route regeneration, testing manifest generation/check, contract generation/check, suite coverage generation/check, test-fixture build, focused stream preview/schema tests `36/36`, public asset tests, targeted ESLint, `git diff --check`, and package/lockfile guard.
- `npm run test:contracts` is expected to fail only on the known unrelated runtime check: `api:http:GET:/discovery/search` returns `500 !== 200`.

## Risks / Blockers

- Durable preview storage is absent. The default production dependency fails with `501` rather than discarding the thumbnail and pretending the preview was persisted.
- `GET /streams/{stream_key}/preview` remains unchanged and still returns `204` for readable active streams because no local preview source exists.
