# entitlements_partner_promotions_param_post

## Summary

Implemented the assigned method-scoped route `POST /entitlements/partner-promotions/{param}` only.

The endpoint is authenticated and fails closed with `501 APIErrorResponse` because Spacebar has no durable partner-promotion entitlement state or partner promotion provider integration to claim or mint an entitlement locally.

## Changed Files

- `src/api/routes/entitlements/partner-promotions/#param.ts`
- `test/routes/entitlements-partner-promotions-param-post.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`

## Assigned Route

- Assigned route: `POST /entitlements/partner-promotions/{param}`
- Assigned route name from target catalog: `PARTNER_PROMOTIONS`
- Implemented source route name: `POST_ENTITLEMENTS_PARTNER_PROMOTIONS_PARAM`
- Source file: `src/api/routes/entitlements/partner-promotions/#param.ts`

## Missing-Route Movement

- Before regeneration from `HEAD`: `missing: 525`; assigned POST entry present.
- After regeneration: `missing: 524`; assigned POST entry removed.
- `packages/missing-routes/missing.json` no longer contains `POST /entitlements/partner-promotions/{param}`.

## Evidence Sources

- `packages/missing-routes/missing.json`: assigned missing entry was present before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`: xHyroM source has `OPTIONS` and `POST` for `/entitlements/partner-promotions/{param}` with route name `PARTNER_PROMOTIONS`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: regenerated local source catalog now has only `POST /entitlements/partner-promotions/{param}` for this assigned path.
- Nearby local patterns: authenticated fail-closed unsupported mutation routes such as `src/api/routes/applications/shelf.ts` and commerce/promotion compatibility routes under `src/api/routes/promotions.ts`, `src/api/routes/users/@me/outbound-promotions/codes.ts`, and `src/api/routes/entitlements/gift-codes/#gift_code_code.ts`.
- Userdoccers: no matching Userdoccers route entry was present for this path in the local catalog; the assignment evidence was xHyroM-only.

## Behavior

- Requires bearer auth through normal API authentication middleware.
- Does not add a no-auth exemption.
- Does not parse or invent a request body.
- Throws `ApiError("Partner promotion claims are not supported on this Spacebar instance.", 0, 501)` after auth instead of fabricating an entitlement or returning a false success.
- Declares `401` and `501` `APIErrorResponse` metadata for OpenAPI, manifest, source catalog, and contracts.

## Sibling Routes Intentionally Untouched

- Did not implement `OPTIONS /entitlements/partner-promotions/{param}`. Missing-route generation ignores OPTIONS by default and this assignment was method-scoped to POST.
- Did not implement `/entitlements/gift-codes/{param}/redeem`, `/users/@me/entitlements/gift-codes`, or other entitlement/promotion routes.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/entitlements-partner-promotions-param-post.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/routes/entitlements/partner-promotions/#param.ts test/routes/entitlements-partner-promotions-param-post.test.ts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json`

## Verification Results

- Focused route test: passed, 3/3.
- `npm run build:src:tsgo`: passed.
- `npm run build:test-fixtures`: passed.
- `npm run test:manifest`: passed.
- `npm run test:suite-coverage`: passed.
- Targeted ESLint: passed.
- `git diff --check`: passed.
- Package/lockfile guard: passed, no package or lockfile diffs.
- `npm run test:contracts`: generated contract checks passed, then failed only in runtime public response-schema contracts on known unrelated `api:http:GET:/discovery/search` with `500 !== 200`.

## Risks Or Blockers

- Local behavior is intentionally fail-closed because there is no provider-backed partner promotion state to claim.
- The route shape is sourced from xHyroM only; no Userdoccers documentation was available locally for request or success response fields.
- Runtime contract suite still has the pre-existing unrelated discovery search failure noted in the assignment.

## Reconciliation Notes

- `npm ci` was needed because this worktree had no `node_modules`; it did not change package or lock files.
- `npm run generate:suite-coverage` produced no diff after verification because this route remains in the contract tier, not a suite-specific scenario tier.
