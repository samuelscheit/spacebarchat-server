# entitlements-gift-codes-param-get

## Summary

Integrated `GET /entitlements/gift-codes/{gift_code_code}` on current `master` base `c6cdb1ae0`.

The route is public/no-auth to match Discord compatibility, accepts the documented `with_application` and `with_subscription_plan` query flags, documents a `200 GiftCodeResponse` and `404 APIErrorResponse`, and currently returns `UNKNOWN_GIFT_CODE` because Spacebar has no durable gift-code redemption or commerce state for public gift-code lookup.

## Changed Files

- `src/api/routes/entitlements/gift-codes/#gift_code_code.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/api/middlewares/Authentication.test.ts`
- `src/schemas/responses/GiftCodeResponse.ts`
- `src/schemas/responses/index.ts`
- `test/scenarios/entitlements-gift-codes.test.ts`
- `testing/suite-coverage-policy.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/entitlements-gift-codes-param-get.md`

Package manifests and lockfiles were not changed.

## Count Movement

- Before integration on current base: `822` missing, `358` implemented.
- After regeneration: `821` missing, `359` implemented.
- Movement: assigned route removed from the missing backlog.

## Verification

- `npm run build:src:tsgo` - passed.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/middlewares/Authentication.test.js dist-test/test/scenarios/entitlements-gift-codes.test.js` - passed, `22` tests.
- `npm run generate:schema` - passed, wrote `721` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; reported `Spacebar is missing 821`, `Spacebar implements 359`, `Discord implements 1128`.
- `npm run generate:testing-manifest` - passed, wrote `464` entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `npm run generate:contract-tests` and `node scripts/testing-manifest/generate-contract-tests.js --check` - passed, `439` contracts.
- `npm run generate:suite-coverage` and `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed, `15` suites.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, `13` tests.
- `npm run generate:openapi` - passed, generated `284` paths and `721` schemas with only the existing webhook route-metadata warnings.

## Completion Audit

| Requirement | Evidence | Status |
| --- | --- | --- |
| Implement exact assigned route | `src/api/routes/entitlements/gift-codes/#gift_code_code.ts` adds `GET /entitlements/gift-codes/:gift_code_code/`. | Done |
| Keep route public/no-auth | `NoAuthorizationRoutes.ts` allows `GET`/`HEAD` gift-code lookup and `Authentication.test.ts` covers the exemption. | Done |
| Avoid fabricated commerce state | Handler throws `DiscordApiErrors.UNKNOWN_GIFT_CODE` until a durable public gift-code store exists. | Done |
| Document response contract | Route metadata includes `GiftCodeResponse`, `APIErrorResponse`, and documented query flags. | Done |
| Add focused tests | Auth-boundary and mounted-route tests pass. | Done |
| Regenerate artifacts | Source catalog, missing routes, schemas, testing manifest, contract tests, suite coverage, and OpenAPI regenerated. | Done |
| Verify count movement | Missing route count moved from `822` to `821`; implemented count moved from `358` to `359`. | Done |

Audit conclusion: the assigned route is integrated, tested, regenerated into generated artifacts, and ready to commit from current `master`.
