# channels-preload-messages-get

## Summary

Accepted and integrated `GET /channels/preload-messages` on current base
`50230fcb4`.

The route accepts source-backed `channel_ids` query values, reuses the existing
preload authorization/latest-message serialization path, enforces the existing
preload count limit, and returns `PreloadMessagesResponse` without fabricating
message data. Existing `POST /channels/preload-messages` behavior is preserved
through the same helper.

## Changed Files

- `src/api/routes/channels/preload-messages.ts`
- `test/routes/channels-preload-messages-get.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/channels-preload-messages-get.md`

## Evidence

- `packages/missing-routes/missing.json` contained the assigned missing entry:
  `GET /channels/preload-messages` with xHyroM route name `MESSAGE_PREVIEWS`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  lists `DELETE`, `GET`, `HEAD`, `OPTIONS`, `PATCH`, `POST`, and `PUT` for
  `/channels/preload-messages` as `MESSAGE_PREVIEWS`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
  lists only `POST /channels/preload-messages` for this path.
- The existing local POST route already used `getChannelIdSetWithPermissions`
  with `VIEW_CHANNEL` and `READ_MESSAGE_HISTORY`, latest message lookup, and
  `toPreloadMessageResponse`.

## Behavior

- GET parses `channel_ids` and `channel_ids[]`, including repeated and
  comma-separated query values.
- GET intentionally does not treat the local POST-only `channels` body alias as
  a query parameter.
- GET and POST enforce `Config.get().limits.message.maxPreloadCount`.
- Unauthorized channels are filtered before latest-message lookup.
- Empty or unsupported channel lists return an empty array through the shared
  preload helper.

## Missing-Route Movement

- Current base: `50230fcb4`
- Missing count: `556 -> 555`
- Spacebar implemented count: `624 -> 625`
- Discord implemented count: `1128`
- Removed from missing: `GET /channels/preload-messages`
- Still intentionally missing for this path: `DELETE`, `PATCH`, and `PUT`

## Verification

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
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/channels-preload-messages-get.test.js dist-test/src/api/util/utility/Messages.test.js`
- `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test src/api/util/utility/PreloadMessages.test.ts src/schemas/responses/PreloadMessagesResponseSchema.test.ts`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx eslint src/api/routes/channels/preload-messages.ts test/routes/channels-preload-messages-get.test.ts`
- `npx prettier --check src/api/routes/channels/preload-messages.ts test/routes/channels-preload-messages-get.test.ts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`
- `rg -n 'MERMER|MERCHANTIBILITY' src/api/routes/channels/preload-messages.ts test/routes/channels-preload-messages-get.test.ts`

## Verification Notes

- Focused built route/helper tests passed: `15/15`.
- Source helper/schema tests passed: `5/5`.
- Testing manifest verification passed: `730` entries.
- Generated HTTP contract static checks passed: `705` contracts and `10/10`
  matrix tests.
- Generated suite coverage checks passed: `4/4` tests.
- OpenAPI regeneration produced `514` paths and `1165` schemas.
- Package and lockfile guard passed; `package.json` and `package-lock.json`
  are unchanged.
- `npm run test:contracts` failed only on the known unrelated runtime contract:
  `api:http:GET:/discovery/search` returned `500` instead of `200`. Existing
  analytics `query.ts` route-registration noise remains unrelated.

## Risks And Boundaries

- Userdoccers documents POST only; GET is xHyroM route-list evidence. The GET
  implementation is therefore a conservative query wrapper over existing local
  preload semantics instead of inferred broader Discord-private behavior.
- Existing local POST behavior includes any channel for which local permission
  checks pass. GET shares that local authorization behavior for consistency.
- No DELETE, PATCH, PUT, message fetch/search, pin, thread, ack, typing,
  billing, Nitro, or gateway behavior was implemented.
