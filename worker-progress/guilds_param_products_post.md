# guilds_param_products_post

## Summary

Implemented the assigned method-scoped route `POST /guilds/{param}/products` (`GUILD_PRODUCTS`) only. The route is mounted at `src/api/routes/guilds/#guild_id/products.ts`, requires bearer auth and `MANAGE_GUILD`, confirms the guild row exists, then fails closed with a typed 501 `ApiError` because Spacebar does not currently persist Discord guild product store/SKU/listing/attachment/entitlement/payout provider state.

## Changed Files

- `src/api/routes/guilds/#guild_id/products.ts`
- `test/routes/guilds-param-products-post.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds_param_products_post.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had exactly one assigned entry: `POST /guilds/{param}/products`, route name `GUILD_PRODUCTS`, source route `/guilds/{guild_id}/products`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `POST /guilds/{guild_id}/products` entry before implementation.
- `src/api/routes/guilds/#guild_id` had no products route file before implementation.
- Local xHyroM catalog confirmed `OPTIONS` and `POST` for `/guilds/{guild_id}/products`, with route name `GUILD_PRODUCTS`.
- Userdoccers references used:
  - `https://docs.discord.food/resources/store` for SKU/product/storefront product structures and guild product product-line context.
  - `https://docs.discord.food/resources/guild` for `GUILD_PRODUCTS`, `GUILD_PRODUCTS_ALLOW_ARCHIVED_FILE`, and `PRODUCTS_AVAILABLE_FOR_PURCHASE` guild features.
- Nearby Spacebar patterns used:
  - `src/api/routes/guilds/#guild_id/creator-monetization/marketing/onboarding.ts` for fail-closed provider-backed guild monetization state.
  - `src/api/routes/guilds/#guild_id/role-subscriptions/templates.ts` and storefront/store utility routes for local-provider boundaries around absent Discord store state.

## Missing Route Movement

- Before: `missing = 508`, `spacebar = 672`, `discord = 1128`.
- After regeneration: `missing = 507`, `spacebar = 673`, `discord = 1128`.
- Removed assigned missing entry:
  - `POST /guilds/{param}/products` (`GUILD_PRODUCTS`)
- Source catalog now includes:
  - `POST /guilds/{guild_id}/products`
  - source `src/api/routes/guilds/#guild_id/products.ts`
  - response schema refs `["APIErrorResponse"]`

## Sibling Routes Intentionally Untouched

- `POST /guilds/{param}/products/attachments`
- `DELETE /guilds/{param}/products/listings/{param}`
- `GET /guilds/{param}/products/listings/{param}`
- `PATCH /guilds/{param}/products/listings/{param}`
- `POST /guilds/{param}/products/listings/{param}/attachments/{param}/download`

## Commands Run

- `npm ci` (needed because this isolated worktree had no `node_modules`)
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` - passed, wrote `missing = 507`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` - passed, 778 entries
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` - passed, 753 contracts
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-products-post.test.js` - passed, 7 tests
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` - failed only on known unrelated runtime contract `api:http:GET:/discovery/search` with `500 !== 200`; static contract checks passed first
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/routes/guilds/#guild_id/products.ts test/routes/guilds-param-products-post.test.ts` - passed
- `git diff --check` - passed
- `git diff -- package.json package-lock.json` - no changes
- Completion audit rerun:
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-products-post.test.js` - passed, 7 tests
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check` - passed, 753 contracts verified
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest` - passed, 778 entries verified
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage` - passed
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/routes/guilds/#guild_id/products.ts test/routes/guilds-param-products-post.test.ts` - passed

## Risks And Blockers

- Durable guild product creation cannot be implemented truthfully without backing store/SKU/listing/attachment/entitlement/payout state and provider integrations. The route therefore fails closed with 501 after auth, permission, and guild existence checks.
- No gateway or audit-log side effects are emitted because no mutation is performed.
- The generated source route name is `POST_GUILDS_GUILD_ID_PRODUCTS`; the assigned Discord/xHyroM route name `GUILD_PRODUCTS` was used to identify and remove the missing entry.

## Reconciliation Notes

- `package.json` and `package-lock.json` are unchanged after `npm ci`.
- `git diff --check` passes after the progress report update.
- The worktree remains scoped to the assigned route and generated artifacts; no sibling product route file was added.
- Completion audit confirmed the source catalog has only `POST /guilds/{guild_id}/products` under the assigned guild-products path, while the remaining product attachment/listing routes are still present in `missing.json`.

## Recommended Next Tasks

- Implement a real guild product storage/provider abstraction before changing this route from fail-closed 501 to product creation.
- Assign sibling routes separately if product attachments, product listings, or listing attachment downloads should be implemented.
