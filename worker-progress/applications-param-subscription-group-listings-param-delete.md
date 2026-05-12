# DELETE /applications/{param}/subscription-group-listings/{param}

Stable worker id: `applications_param_subscription_group_listings_param_delete`

Assigned route: `DELETE /applications/{param}/subscription-group-listings/{param}`

Assigned route name: `APPLICATION_SUBSCRIPTION_GROUP_LISTING`

## Summary

Implemented the assigned DELETE route on the existing application subscription group listing detail router.

- Requires authenticated application store access through `requireApplicationStoreAccess`.
- Validates application and subscription group listing IDs as snowflakes.
- Deletes through an injected `listingDeleter` when durable backing exists.
- Returns `204` only when the deleter explicitly confirms deletion.
- Fails closed with `404 Unknown Store Listing` by default because Spacebar does not currently persist Discord application subscription group listing catalogs.

## Changed Files

- `src/api/routes/applications/#application_id/subscription-group-listings/#subscription_group_listing_id.ts`
- `test/routes/applications-subscription-group-listing.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Sources

- `packages/missing-routes/missing.json` contained the assigned DELETE entry with route name `APPLICATION_SUBSCRIPTION_GROUP_LISTING`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `DELETE /applications/{application_id}/subscription-group-listings/{param}` with route name `APPLICATION_SUBSCRIPTION_GROUP_LISTING`.
- Existing GET implementation in `src/api/routes/applications/#application_id/subscription-group-listings/#subscription_group_listing_id.ts` established application store access, provider-backed data, and fail-closed default behavior.
- Local persistence check: no durable subscription group listing catalog entity or provider-backed deletion path exists.

## Current-Base Movement

Base commit: `61ba6e9a0`

- `missing`: 542 -> 541
- `spacebar`: 638 -> 639
- `discord`: 1128
- Assigned DELETE route removed from `missing_entries`.
- The already implemented GET remains present; adjacent subscription, store, SKU, billing, entitlement, and role-subscription routes were left untouched.

## Verification

Passed:

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
- Focused built test: `applications-subscription-group-listing.test.js` (`8/8`).
- `npm run test:manifest`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run test:suite-coverage`
- Targeted ESLint on touched TypeScript files
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`

`npm run test:contracts` passed generated/static contract checks and failed only on the known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`.

## Risks / Blockers

- Spacebar has no durable local application subscription group listing persistence, so the default DELETE behavior cannot truthfully return `204`.
- A future durable provider can plug into the injected `listingDeleter` path and return `204` when a row is actually deleted.

## Adjacent Routes Untouched

- Application SKU routes, store listing routes, storefront routes, subscription listings, role subscription routes, entitlement/billing/purchase/trial routes.
