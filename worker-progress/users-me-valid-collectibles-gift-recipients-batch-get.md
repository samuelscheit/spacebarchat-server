# GET /users/@me/valid-collectibles-gift-recipients-batch

## Summary

Implemented the assigned `GET /users/@me/valid-collectibles-gift-recipients-batch` route only. The route accepts `recipient_id` and `sku_ids` query fields, stays behind bearer auth, returns a SKU-keyed map of `{ valid }` objects, and reuses the singular collectibles gift-recipient eligibility semantics. Spacebar currently has no durable collectible gift eligibility/catalog ownership backing, so the default provider conservatively returns `false` for every requested SKU without fabricating Discord-only state.

## Changed Files

- `src/api/routes/users/@me/valid-collectibles-gift-recipients-batch.ts`
- `test/routes/users-me-valid-collectibles-gift-recipients-batch-route.test.ts`
- `src/schemas/responses/CollectiblesShopResponse.ts`
- `src/schemas/responses/CollectiblesCategoriesResponse.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially listed the assigned route as `GET /users/@me/valid-collectibles-gift-recipients-batch` with route name `GET_USERS__ME_VALID_COLLECTIBLES_GIFT_RECIPIENTS_BATCH` and source `userdoccers:resources/collectibles.mdx`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists both the singular and batch collectibles gift-recipient routes from `userdoccers:resources/collectibles.mdx`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists only the singular `valid-collectibles-gift-recipient` route; no xHyroM batch entry was present.
- Userdoccers `pages/resources/collectibles.mdx` documents the batch endpoint as `recipient_id` plus array `sku_ids`, returning a mapping from SKU ID to the same gift eligibility wrapper used by the singular route.
- Existing local behavior in `src/api/routes/users/@me/valid-collectibles-gift-recipient.ts` and `test/routes/users-me-valid-collectibles-gift-recipient-route.test.ts` defines the local truth: validated snowflake query fields, bearer auth, `{ valid: boolean }`, self-gift invalid, and default fail-closed eligibility.

## Missing Route Movement

- Before regeneration: `missing: 606`, `spacebar: 574`.
- After regeneration: `missing: 605`, `spacebar: 575`.
- Assigned missing entry removed from `packages/missing-routes/missing.json`.
- Source catalog now contains `GET /users/@me/valid-collectibles-gift-recipients-batch` from `src/api/routes/users/@me/valid-collectibles-gift-recipients-batch.ts`.

## Behavior

- Auth: bearer-protected, not added to no-auth routes.
- Query validation: requires snowflake `recipient_id` and 1-100 snowflake `sku_ids`; accepts repeated, comma-separated, and `sku_ids[]` query forms; invalid input returns `INVALID_FORM_BODY`.
- Response: `CollectiblesGiftRecipientsBatchEligibilityResponse`, a SKU-keyed object whose values are `CollectiblesGiftRecipientEligibilityResponse`.
- Eligibility: calls the same provider shape as the singular route for each deduplicated SKU; self-gifts return false without calling the provider.
- Adjacent routes intentionally untouched: singular `GET /users/@me/valid-collectibles-gift-recipient` behavior, collectibles purchase/shop routes, gift/entitlement/billing flows.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` - initially failed before dependencies were installed because `tsgo` was not present.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci` - installed local worktree dependencies; no package or lockfile diff.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` - passed; existing warnings for routes missing `route()` middleware remain unrelated.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm test -- test/routes/users-me-valid-collectibles-gift-recipient-route.test.ts test/routes/users-me-valid-collectibles-gift-recipients-batch-route.test.ts src/schemas/responses/CollectiblesCategoriesResponse.test.ts` - passed, 16 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" git diff --exit-code -- package.json package-lock.json` - passed, no package or lockfile changes.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, 13 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` - failed only on known unrelated runtime failure: `api:http:GET:/discovery/search` returned `500 !== 200` in `generated HTTP public response-schema contracts match real API responses`. Contract generation and non-runtime contract tests passed first.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" git diff --check` - passed.

## Risks / Blockers

- The route cannot answer true Discord gift eligibility until Spacebar has persisted collectible gift/catalog ownership state. Current behavior is intentionally conservative.
- The 100 SKU limit follows existing local batch query practice and bounds provider work; Userdoccers documents an array but does not specify a limit.
- `npm run test:contracts` is blocked by the existing unrelated `GET /discovery/search` runtime `500 !== 200` failure, not by this route.

## Reconciliation

- Worktree branch is still at assigned base `449432891 Implement current user claimed quests route`.
- No rebase, merge, commit, push, reset, stash, or remote modification was performed.
- Reconciliation to any newer integration main may be needed by the orchestrator before merge if main has advanced past `449432891`.

## Recommended Next Tasks

- Merge after orchestrator review and conflict check.
- When a durable collectibles gift eligibility model exists, replace the default fail-closed provider with provider-backed eligibility.
