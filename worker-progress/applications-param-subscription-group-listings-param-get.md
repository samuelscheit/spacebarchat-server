# applications-param-subscription-group-listings-param-get

## Summary

Implemented `GET /applications/{application_id}/subscription-group-listings/{subscription_group_listing_id}` as an authenticated application-store-access route with provider-backed response support. Spacebar does not persist Discord application subscription group listing catalogs, so the default local behavior fails closed with Discord's `Unknown Store Listing` error instead of fabricating commerce state.

## Changed Files

- `src/api/routes/applications/#application_id/subscription-group-listings/#subscription_group_listing_id.ts`
- `src/schemas/responses/ApplicationSubscriptionGroupListingResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/applications-subscription-group-listing.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Sources

- `packages/missing-routes/missing.json`: assigned GET route was present at base with route name `APPLICATION_SUBSCRIPTION_GROUP_LISTING`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`: xHyroM lists GET/DELETE/HEAD/OPTIONS for `/applications/{application_id}/subscription-group-listings/{param}` with route name `APPLICATION_SUBSCRIPTION_GROUP_LISTING`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: assigned GET route was absent before implementation and present after regeneration.
- Nearby implementation patterns: `src/api/routes/store/listings/#store_listing_id.ts`, `src/api/routes/store/skus/#sku_id/listings.ts`, `src/api/routes/partner-sdk/applications/#application_id/storefront.ts`, and `src/api/routes/guilds/#guild_id/role-subscriptions/templates.ts`.
- No Userdoccers route entry was attached to this missing entry; the only target source was `xhyrom:data/client/routes.json`.

## Behavior

- Validates both route IDs as Snowflake-like values.
- Requires authenticated application store access through `requireApplicationStoreAccess`.
- Calls an injectable listing provider after authorization.
- Returns a shallow-cloned provider object with `ApplicationSubscriptionGroupListingResponse`.
- Returns 404 `Unknown Store Listing` when no provider data exists, the listing ID is malformed, or provider data is route-mismatched.
- Converts `ACTION_NOT_AUTHORIZED_ON_APPLICATION` to a 403 response, matching nearby application-store routes.

## Missing Route Movement

- Before: `missing = 550`, `spacebar = 630`.
- After regeneration: `missing = 549`, `spacebar = 631`.
- Removed missing entry: `GET /applications/{param}/subscription-group-listings/{param}` with route name `APPLICATION_SUBSCRIPTION_GROUP_LISTING`.
- Still missing and intentionally untouched: `DELETE /applications/{param}/subscription-group-listings/{param}` with route name `APPLICATION_SUBSCRIPTION_GROUP_LISTING`.

## Adjacent Routes Untouched

- Did not implement application storefront routes.
- Did not implement purchase, billing, subscription mutation, entitlement mutation, guild role subscription listing, or subscription-plan group-listing routes.
- Did not modify unrelated existing route behavior.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx prettier --write src/api/routes/applications/#application_id/subscription-group-listings/#subscription_group_listing_id.ts src/schemas/responses/ApplicationSubscriptionGroupListingResponse.ts src/schemas/responses/index.ts test/routes/applications-subscription-group-listing.test.ts`
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
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test -- test/routes/applications-subscription-group-listing.test.ts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo && PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/applications-subscription-group-listing.test.js`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`

## Verification Results

- Focused source route test: pass.
- Focused compiled `dist-test` route test: pass.
- `npm run build:src:tsgo`: pass.
- `npm run build:test-fixtures`: pass.
- `npm run test:manifest`: pass.
- `npm run test:suite-coverage`: pass.
- `git diff --check`: pass.
- Package/lockfile guard: pass, no diff in `package.json` or `package-lock.json`.
- `npm run test:contracts`: generated/static contract checks pass, then fails only on known unrelated runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`.

## Risks And Blockers

- The exact Discord response shape is not documented by Userdoccers in the local missing-route entry. The route therefore exposes a permissive object response schema and relies on a provider for any local deployment that wants to serve real subscription group listing data.
- Default behavior is intentionally conservative 404 because Spacebar has no persisted private subscription group listing catalog.

## Reconciliation Notes

- `node_modules` was absent in this worktree, so `npm ci` was required before `tsgo` and generator commands could run.
- Generated artifacts were refreshed after schema and source-route changes.
- The remaining missing entry for the same canonical path is DELETE, outside the assigned GET scope.
