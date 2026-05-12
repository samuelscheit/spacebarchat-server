# GET /users/@me/entitlements

## Summary

Implemented the assigned `GET /users/@me/entitlements` route only. The route remains behind bearer authentication and returns Spacebar's locally truthful current representation: an empty entitlement array, without fabricating Discord purchase, subscription, SKU, application, or ended-entitlement state.

## Evidence Gathered

- `packages/missing-routes/missing.json` had one assigned missing entry: `GET /users/@me/entitlements`, route name `GET_USERS__ME_ENTITLEMENTS`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `GET /users/@me/entitlements` from `userdoccers:resources/entitlement.mdx` with summary `Get User Entitlements`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `GET /users/@me/entitlements` as `ENTITLEMENTS_FOR_USER`.
- Existing local patterns returned empty arrays for adjacent entitlement surfaces:
  - `src/api/routes/users/@me/applications/#application_id/entitlements.ts`
  - `src/api/routes/applications/#application_id/entitlements.ts`
  - `src/api/routes/users/@me/entitlements.ts` for `/gifts`
- Captured source evidence in `packages/automatic-reverse-engineering/data/coverage/2026-05-07T23-06-28Z-stable-expanded/routes.coverage.md` shows `GET /users/@me/entitlements` responding with the array response-shape hash used for empty arrays. The run request included `with_sku=false`, `with_application=false`, `entitlement_type=11`, and `exclude_ended=true`.

## Changed Files

- `src/api/routes/users/@me/entitlements.ts`
- `src/schemas/responses/CollectiblesShopResponse.ts`
- `test/routes/users-me-entitlements-route.test.ts`
- `test/scenarios/users-entitlements-gifts.test.ts`
- `scripts/testing-manifest/generate-contract-tests.js`
- Regenerated: `assets/schemas.json`, `assets/openapi.json`, `assets/testing-manifest.json`, `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`, `packages/missing-routes/missing.json`, `test/generated/http-contracts.json`, `test/generated/http-auth-runtime-contracts.test.ts`, `test/generated/suite-coverage.json`

## Behavior

- `GET /users/@me/entitlements/` returns `200 []`.
- Query parameters are documented for source-observed compatibility: `with_sku`, `with_application`, `entitlement_type`, `exclude_ended`.
- The route has `UserEntitlementsResponse` response metadata and `APIErrorResponse` for auth failures.
- The existing `GET /users/@me/entitlements/gifts` behavior remains `200 []`.
- Intentionally untouched: `/users/@me/entitlements/gift-codes`, `/users/@me/entitlements/gift-codes/{param}`, application entitlement mutation routes, billing subscription routes, store purchase routes, and entitlement consume/mutation flows.

## Missing-Route Movement

- Worker base movement: `missing: 600 -> 599`, `spacebar: 580 -> 581`, `discord: 1128`.
- Integration base movement: `missing: 598 -> 597`, `spacebar: 582 -> 583`, `discord: 1128`.
- `GET /users/@me/entitlements` was removed from `missing_entries`.

## Commands Run

- `npm ci`
- `prettier --write src/api/routes/users/@me/entitlements.ts src/schemas/responses/CollectiblesShopResponse.ts test/routes/users-me-entitlements-route.test.ts test/scenarios/users-entitlements-gifts.test.ts scripts/testing-manifest/generate-contract-tests.js`
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
- `npm test -- test/routes/users-me-entitlements-route.test.ts test/scenarios/users-entitlements-gifts.test.ts`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-entitlements-route.test.js dist-test/test/scenarios/users-entitlements-gifts.test.js`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test --test-name-pattern "authenticated response-schema" dist-test/test/generated/http-auth-runtime-contracts.test.js`
- `git diff --check`
- `git diff -- package.json package-lock.json --exit-code`
- Current-base verification after porting to `ce14938ad5c3bd3af96e7f4b8aa8903719129d83`:
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
  - `npm test -- test/routes/users-me-entitlements-route.test.ts test/scenarios/users-entitlements-gifts.test.ts`
  - `npm run build:test-fixtures`
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-entitlements-route.test.js dist-test/test/scenarios/users-entitlements-gifts.test.js`
  - `node scripts/testing-manifest/verify.js`
  - `node scripts/testing-manifest/generate-contract-tests.js --check`
  - `node scripts/testing-manifest/generate-suite-coverage.js --check`
  - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
  - `npm run test:suite-coverage`
  - `npm run lint`
  - `git diff --check`
  - `git diff --exit-code -- package.json package-lock.json bun.lock`
  - `npm run test:contracts`

## Verification Notes

- Focused source and compiled route/scenario tests passed.
- Current-base focused source and compiled route/scenario tests passed: 5 tests passing in each run.
- Current-base manifest verification passed with 688 entries.
- Current-base generated HTTP contract checks passed with 663 contracts.
- Generated manifest, generated HTTP contract matrix, and generated suite coverage checks passed.
- `npm run build:src:tsgo` and `npm run build:test-fixtures` passed.
- The generated authenticated runtime response-schema test was invoked for the relevant category but skipped because `hasPostgresAdminUrl()` was false in this environment.
- Package and lockfile guard passed; `package.json` and `package-lock.json` were unchanged.
- On current base, `npm run test:contracts` failed only in the known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`. The generated contract matrix passed before that runtime stage.

## Risks And Reconciliation

- The route intentionally returns only an empty local array because Spacebar has no durable global current-user entitlement persistence. If entitlement persistence is added later, this route should filter by authenticated user and honor the documented query flags against that local backing.
- Worker base was `ea0304bf2`; orchestrator ported the route, tests, and generator change onto current base `ce14938ad`, then regenerated current-base artifacts.
