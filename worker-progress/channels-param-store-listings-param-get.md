# GET /channels/{param}/store-listings/{param}

## Summary

Integrated `GET /channels/{channel_id}/store-listings/{sku_id}` on current main from the completed worker handoff. The accepted route is bearer-protected, requires `VIEW_CHANNEL`, requires the target channel to be a guild store channel, parses existing store SKU localization query fields, and returns a provider-backed `StoreListingResponse` only when the listing SKU matches the requested SKU.

Spacebar does not currently persist Discord channel store listing catalogs, so the default provider fails closed with `Unknown Store Listing` instead of fabricating data.

## Changed Files

- `src/api/routes/channels/#channel_id/store-listings/#sku_id.ts`
- `test/routes/channels-param-store-listings-param-get.test.ts`
- `test/routes/channels-param-store-listing-get.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/channels-param-store-listings-param-get.md`

## Current-Base Movement

- Missing routes: `603 -> 602`
- Implemented Spacebar routes: `577 -> 578`
- Discord routes: `1128`
- Removed only `GET /channels/{param}/store-listings/{param}`.
- Kept adjacent `POST /channels/{param}/store-listing/entitlement-grant` missing.

## Verification

- `npm run build:src:tsgo`
- `npm run generate:openapi` (`469` paths / `1093` schemas)
- automatic reverse-engineering build/import
- missing-routes build/start (`602` missing / `578` implemented / `1128` Discord)
- testing manifest generation/verification (`683` entries)
- generated contract generation/check (`658` contracts)
- suite coverage generation/check
- `npm run build:test-fixtures`
- focused built tests: channel store-listing singular and plural, `10/10`
- generated contract/suite tests, `13/13`
- `npm run test:suite-coverage`
- `npm run lint`
- `git diff --check`
- package/lockfile guard
- `npm run test:contracts` failed only on the known unrelated `api:http:GET:/discovery/search` runtime `500 !== 200`.

## Integration Notes

- The worker route originally imported the sibling `store-listing` route file. Current-main integration keeps the small channel-type guard local instead, because importing a route file from another route file causes OpenAPI route discovery to register the sibling route under the wrong current path and drop the existing singular route.
- The singular `test/routes/channels-param-store-listing-get.test.ts` missing-route assertion was updated because this integration now implements the plural SKU route it previously expected to remain missing.
