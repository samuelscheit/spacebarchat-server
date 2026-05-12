# partner-sdk-applications-param-storefront-get

## Summary

Accepted and integrated `GET /partner-sdk/applications/{param}/storefront` as
`GET /partner-sdk/applications/:application_id/storefront/` on current base
`cf864bbbb`.

The route is bearer-authenticated, validates the application snowflake, requires
the current user to have application store access, and returns a provider-backed
application storefront response when local data exists. Spacebar does not
currently persist Discord application storefront layouts, so the default
behavior fails closed with `404 Unknown Storefront` instead of fabricating
storefront content.

## Changed Files

- `src/api/routes/partner-sdk/applications/#application_id/storefront.ts`
- `src/schemas/responses/PartnerSdkApplicationStorefrontResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/partner-sdk-applications-param-storefront-route.test.ts`
- `assets/openapi.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/partner-sdk-applications-param-storefront-get.md`

## Evidence

- `packages/missing-routes/missing.json` contained `GET`, `PUT`, and `DELETE`
  for `/partner-sdk/applications/{param}/storefront`.
- The xHyroM catalog names the GET route
  `GET_PARTNER_SDK_APPLICATIONS_APPLICATION_ID_STOREFRONT`.
- The local sibling `partner-sdk/application/:application_id/skus` route already
  uses `requireApplicationStoreAccess`; this route shares that application
  authorization boundary.
- Existing store listing serializers provide a conservative way to expose
  provider-backed store listing data without leaking source-only fields.

## Behavior

- `401` for missing bearer auth through the standard auth middleware.
- `403` when the caller cannot access the owning application.
- `404` for malformed application IDs, unknown applications, missing storefront
  data, or provider data for a different application ID.
- `200` returns `PartnerSdkApplicationStorefrontResponse` when a local provider
  supplies matching application storefront data.
- Storefront pages, sections, leaderboards, assets, and store listings are
  cloned or serialized so source-only fields are not exposed.

## Missing-Route Movement

- Current base: `cf864bbbb`
- Missing count: `554 -> 553`
- Spacebar implemented count: `626 -> 627`
- Discord implemented count: `1128`
- Removed from missing:
  `GET /partner-sdk/applications/{param}/storefront`
- Still intentionally missing for this path: `PUT`, `DELETE`
- Related guild storefront route remains intentionally missing:
  `GET /partner-sdk/guilds/{param}/application-storefront`

## Verification

- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test test/routes/partner-sdk-applications-param-storefront-route.test.ts`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/partner-sdk-applications-param-storefront-route.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npm run lint -- 'src/api/routes/partner-sdk/applications/#application_id/storefront.ts' src/schemas/responses/PartnerSdkApplicationStorefrontResponse.ts test/routes/partner-sdk-applications-param-storefront-route.test.ts`
- `npx prettier --check 'src/api/routes/partner-sdk/applications/#application_id/storefront.ts' src/schemas/responses/PartnerSdkApplicationStorefrontResponse.ts test/routes/partner-sdk-applications-param-storefront-route.test.ts src/schemas/responses/index.ts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`
- `rg -n 'MERMER|MERCHANTIBILITY' 'src/api/routes/partner-sdk/applications/#application_id/storefront.ts' src/schemas/responses/PartnerSdkApplicationStorefrontResponse.ts test/routes/partner-sdk-applications-param-storefront-route.test.ts`

## Verification Notes

- Focused source route tests passed: `6/6`.
- Focused built route tests passed: `6/6`.
- Testing manifest verification passed: `732` entries.
- Generated HTTP contract static checks passed: `707` contracts and `10/10`
  matrix tests.
- Generated suite coverage checks passed: `4/4` tests.
- OpenAPI regeneration produced `516` paths and `1170` schemas.
- Package and lockfile guard passed; `package.json` and `package-lock.json`
  are unchanged.
- `npm run test:contracts` failed only on the known unrelated runtime contract:
  `api:http:GET:/discovery/search` returned `500` instead of `200`. Existing
  analytics `query.ts` route-registration noise remains unrelated.

## Risks And Boundaries

- The default route behavior is `404 Unknown Storefront` because Spacebar has no
  durable application storefront layout storage today.
- Future persistent storefront storage should update the provider and the
  remaining `PUT`/`DELETE` routes together so read/write semantics stay
  consistent.
- No `PUT` or `DELETE` for this storefront path, no guild storefront route, and
  no storefront layout mutation behavior was implemented.
