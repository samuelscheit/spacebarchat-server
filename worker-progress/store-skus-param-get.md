# store-skus-param-get

## Summary

- Implemented only `GET /store/skus/{sku_id}` as route id `store-skus-param-get` / route name `GET_STORE_SKUS_SKU_ID`.
- Added authenticated `GET /store/skus/:sku_id/` handling with `country_code` and `localize` query parsing.
- Added `StoreSkuResponse` and route metadata for `200`, `400`, `401`, `403`, and `404` responses.
- Spacebar has no durable SKU catalog entity today, so the default route fails closed with `Unknown SKU` (`10027`, `404`) instead of fabricating Discord SKU data. The route supports an injected local SKU provider and enforces application owner/team access before returning provider-backed data.
- Added a reusable application store access helper that matches the Userdoccers owner/team-member requirement and bot-supported route metadata.
- Fixed pre-existing malformed warranty tokens found by the required scan. These are header-only corrections retained during orchestrator merge because the current-base hygiene gate still failed without them.

## Changed Files

- `src/api/routes/store/skus/#sku_id.ts` - new exact route implementation.
- `src/schemas/responses/StoreSkuResponse.ts` and `src/schemas/responses/index.ts` - new response schema export.
- `src/api/util/utility/ApplicationAuthorization.ts` - shared application-store access helper.
- `test/routes/store-skus-param-route.test.ts` - focused behavior and artifact coverage.
- Generated artifacts:
  - `assets/schemas.json`
  - `assets/openapi.json`
  - `assets/testing-manifest.json`
  - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `packages/missing-routes/missing.json`
  - `test/generated/http-contracts.json`
- Header-only warranty typo fixes:
  - `src/api/routes/channels/#channel_id/threads/archived/public.ts`
  - `src/api/routes/channels/#channel_id/users/@me/threads/archived/private.ts`
  - `src/api/routes/users/@me/invites.ts`
  - `src/api/routes/webhooks/#webhook_id/#token/messages/#message_id/index.ts`
  - `src/api/util/handlers/InviteAcceptance.ts`
  - `src/api/util/handlers/InviteAcceptancePolicy.ts`
  - `src/api/util/handlers/Registration.ts`
  - `src/api/util/handlers/WebhookMessage.test.ts`
  - `src/api/util/handlers/WebhookMessage.ts`
  - `src/api/util/handlers/WebhookMessageRoute.test.ts`
  - `src/api/util/utility/Fingerprint.ts`
  - `src/api/util/utility/ForumTags.ts`
  - `src/api/util/utility/JoinedPrivateArchivedThreads.ts`
  - `src/api/util/utility/PaymentSources.ts`
  - `src/api/util/utility/RegistrationTokens.ts`
  - `src/api/util/utility/Relationships.ts`
  - `src/api/util/utility/UserInvites.ts`
  - `src/cdn/routes/role-icons.ts`
  - `src/cdn/util/Storage.ts`
  - `src/schemas/responses/GuildRecommendationsResponse.test.ts`
  - `src/schemas/responses/InviteResponse.ts`
  - `src/schemas/responses/PaymentSourceResponse.ts`
  - `src/schemas/responses/UserInviteResponse.ts`
  - `src/schemas/uncategorised/UserInviteCreateSchema.ts`
  - `src/schemas/uncategorised/WebhookMessageEditSchema.ts`
  - `src/util/util/Fingerprint.ts`
  - `src/util/util/InviteUsage.ts`

## Evidence

- `packages/missing-routes/missing.json` initially had two entries for `/store/skus/{param}`: assigned `GET_STORE_SKUS_SKU_ID` and out-of-scope `PATCH_STORE_SKUS_SKU_ID`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no `/store/skus/{sku_id}` source route.
- `src/api/routes/store/**` initially had no `store/skus` route file.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/store.mdx`, lines 1048-1060, documents `GET /store/skus/{sku.id}`, summary `Get SKU`, OAuth/application store update support, bot support, owner/team-member access, and optional `country_code` and `localize`.
- xHyroM local source: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` documents `GET /store/skus/{param}` as `STORE_SKU`.
- Generated source catalog now has `GET /store/skus/{sku_id}` from `src/api/routes/store/skus/#sku_id.ts` with `StoreSkuResponse` and `APIErrorResponse`.

## Missing Count Movement

- Worker-base movement: `missing = 648 -> 647`, `spacebar = 532 -> 533`.
- Current-base orchestrator merge movement: `missing = 646 -> 645`, `spacebar = 534 -> 535`.
- Removed only assigned `GET /store/skus/{param}` / `GET_STORE_SKUS_SKU_ID`.
- Out-of-scope `PATCH /store/skus/{param}` remains missing.

## Commands Run

- `npm run build:src:tsgo` - initially failed because this fresh worktree had no `node_modules/@types/node`.
- `npm ci` - installed dependencies locally in the assigned worktree; package/lockfile guard later showed no package or lockfile diff.
- `npm run build:src:tsgo` - pass.
- `npm run generate:schema` - pass; worker wrote 1013 schemas; current-base orchestrator merge wrote 1014 schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - pass.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - pass.
- `npm run build --workspace @spacebar/missing-routes` - pass.
- `npm run start --workspace @spacebar/missing-routes` - pass; worker wrote `missing = 647`; current-base orchestrator merge wrote `missing = 645`.
- `npm run generate:testing-manifest` - pass; worker wrote 638 entries; current-base orchestrator merge wrote 640 entries.
- `node scripts/testing-manifest/verify.js` - pass.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - initially reported stale contracts.
- `npm run generate:contract-tests` - pass; worker wrote 613 contracts; current-base orchestrator merge wrote 615 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - pass.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - pass.
- `npm run generate:openapi` - pass; worker wrote 427 paths and 1013 schemas; current-base orchestrator merge wrote 429 paths and 1014 schemas, with only pre-existing webhook route middleware warnings.
- `npm test -- test/routes/store-skus-param-route.test.ts` - pass; 7 tests.
- `npm run build:test-fixtures` - pass.
- `npm run test:contracts` - failed in runtime public response-schema contract for unrelated `api:http:GET:/discovery/search` returning 500 instead of 200. Static generated contract tests passed first, and bearer/auth runtime checks completed before the unrelated public response failure. The same unrelated failure reproduced during current-base orchestrator merge.
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs` - pass; 10 tests.
- `npm run test:suite-coverage` - pass; 4 tests.
- `npm run test:manifest` - pass; 30 tests and manifest verify.
- Final reruns after warranty header fixes:
  - `npm run build:src:tsgo` - pass.
  - `npm test -- test/routes/store-skus-param-route.test.ts` - pass.
  - `npm run build:test-fixtures` - pass.
  - `node scripts/testing-manifest/generate-contract-tests.js --check` - pass.
  - `node scripts/testing-manifest/generate-suite-coverage.js --check` - pass.
  - `node scripts/testing-manifest/verify.js` - pass.
  - `git diff --check` - pass.
  - package/lockfile guard - no diff.
  - malformed warranty-token scan - clean after retaining the header-only typo fixes.

## Artifact Status

- Schemas regenerated and include `StoreSkuResponse`.
- OpenAPI regenerated and includes `/store/skus/{sku_id}/` with bearer security.
- Source catalog regenerated and includes the exact route.
- Missing report regenerated and removed only the assigned GET entry.
- Testing manifest regenerated and verified.
- HTTP contracts regenerated and verified.
- Suite coverage was already current and verified.

## Risks Or Blockers

- Spacebar still lacks durable SKU persistence; default route behavior is intentionally `404 Unknown SKU`.
- Full `npm run test:contracts` remains blocked by an unrelated runtime public response-schema failure for `/discovery/search` returning 500. The failure does not involve the new store SKU route.
- Existing route registration warnings for analytics `query` files appeared during runtime contract startup and are unrelated to this route.

## Next Tasks

- Implement durable SKU persistence/configuration if Spacebar wants `GET /store/skus/{sku_id}` to return real local SKU records without an injected provider.
- Address out-of-scope adjacent store routes separately: `PATCH /store/skus/{param}`, `/store/skus/{param}/listings`, `/store/skus/{param}/plans`, and purchase flows.
- Triage the unrelated `/discovery/search` runtime contract failure in a separate task.
