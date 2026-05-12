<!--
Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
Copyright (C) 2026 Spacebar and Spacebar Contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

# Worker Progress: google_play_verify_purchase_token_post

## Summary

Implemented the assigned xHyroM-only `POST /google-play/verify-purchase-token` compatibility route. The route validates the Google Play purchase-token request body and stays behind bearer authentication. Because this checkout has no configured Google Play publisher verifier, provider credentials, or durable purchase-token entitlement/subscription model, the default implementation fails closed with `501` instead of granting benefits from unverified client input.

The handler exposes an injectable verifier dependency for a future real Google Play integration. A configured verifier can accept the validated token metadata and return `204 No Content`.

## Scope

- Assigned path: `/google-play/verify-purchase-token`.
- Assigned method: `POST`.
- Assigned xHyroM route name: `VERIFY_PURCHASE`.
- Source route catalog name generated locally: `POST_GOOGLE_PLAY_VERIFY_PURCHASE_TOKEN`.
- Implemented methods: `POST` only.
- Adjacent Google Play routes already accepted in main and not modified:
    - `POST /google-play/validate-purchase`
    - `POST /google-play/downgrade-subscription`
- Userdoccers source: none found for Google Play routes in `routes.userdoccers.catalog.json`.

## Behavior

- Auth mode: bearer. The route was not added to `NoAuthorizationRoutes`.
- Request body schema: `GooglePlayVerifyPurchaseTokenSchema`.
- Required field:
    - `purchase_token: string` with `@minLength 1`.
- Optional fields:
    - `package_name: string` with `@minLength 1`.
    - `product_id: string` with `@minLength 1`.
    - `sku_id: Snowflake`.
    - `subscription_plan_id: Snowflake`.
- Request body coercion is disabled with `coerceRequestBody: false`, so non-string tokens are rejected by the schema layer.
- Default verifier throws an `ApiError` with status `501` and message:
    - `Google Play purchase-token verification is not supported on this Spacebar instance.`
- A configured verifier receives `user_id`, `purchase_token`, optional token metadata, request IP, and user agent, then returns `204` on success.

## Changed Files

- `src/api/routes/google-play/verify-purchase-token.ts`
- `src/schemas/uncategorised/GooglePlayVerifyPurchaseTokenSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/routes/google-play-verify-purchase-token-post.test.ts`
- `testing/suite-coverage-policy.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/google_play_verify_purchase_token_post.md`

## Evidence Gathered

- Base `packages/missing-routes/missing.json` had the assigned missing entry:
    - method: `POST`
    - route: `/google-play/verify-purchase-token`
    - route name: `VERIFY_PURCHASE`
- xHyroM catalog has `OPTIONS` and `POST` entries for `/google-play/verify-purchase-token`, both with route name `VERIFY_PURCHASE`.
- Userdoccers catalog has no `google-play` route entries, so there was no Userdoccers request/response documentation to implement from.
- Source catalog now includes:
    - method: `POST`
    - route: `/google-play/verify-purchase-token`
    - route name: `POST_GOOGLE_PLAY_VERIFY_PURCHASE_TOKEN`
    - request schema: `GooglePlayVerifyPurchaseTokenSchema`
    - response schemas: `APIErrorResponse`
    - source: `src/api/routes/google-play/verify-purchase-token.ts`
- Missing-route reconciliation removed the assigned `POST /google-play/verify-purchase-token` entry by method/path despite the generated source route name differing from the xHyroM route name.
- `POST /google-play/validate-purchase` and `POST /google-play/downgrade-subscription` were already accepted before this main reconciliation and remain present.
- Testing manifest now includes `api:http:POST:/google-play/verify-purchase-token/` with `authMode: "bearer"`, request body `GooglePlayVerifyPurchaseTokenSchema`, response statuses `204`, `400`, `401`, and `501`, and `APIErrorResponse` as the error response body.
- Generated HTTP contracts include the same manifest id, auth mode, request body, response body, and response statuses.
- OpenAPI now exposes `POST /google-play/verify-purchase-token/` with bearer security, `GooglePlayVerifyPurchaseTokenSchema`, and `APIErrorResponse` responses for `400`, `401`, and `501`.
- Generated schemas now include `GooglePlayVerifyPurchaseTokenSchema` with `additionalProperties: false` and required `purchase_token`.

## Missing-Route Movement

- Before reconciliation on main: `missing_entries` count was `518`; assigned route was present.
- After regeneration: `missing_entries` count is `517`; assigned route is absent.
- Missing-routes tool output after regeneration:
    - `Spacebar is missing 517`
    - `Spacebar implements 663`
    - `Discord implements 1128`

## Verification

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed.
- `npm run generate:openapi` - passed with existing warnings about webhook routes missing route metadata.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; final output was `Spacebar is missing 517`, `Spacebar implements 663`, `Discord implements 1128`.
- `npm run generate:testing-manifest` - passed; generated 768 entries.
- `npm run generate:contract-tests` - passed; generated 743 contracts.
- `npm run generate:suite-coverage` - passed; generated 15 suites.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/google-play-verify-purchase-token-post.test.js` - passed, 6 tests.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs` - passed, 10 tests.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run test:manifest` - passed.
- `npm run test:suite-coverage` - passed.
- `npx eslint src/api/routes/google-play/verify-purchase-token.ts src/schemas/uncategorised/GooglePlayVerifyPurchaseTokenSchema.ts src/schemas/uncategorised/index.ts test/routes/google-play-verify-purchase-token-post.test.ts` - passed.
- `npm run test:contracts` - failed only on the known unrelated runtime failure: `api:http:GET:/discovery/search should return a successful response for schema validation`, `500 !== 200`. Generated contract checks and runtime build steps completed before that unrelated failure.
- `git diff --check` - passed.
- Package/lockfile guard passed: `git diff -- package.json package-lock.json` and `git status --short -- package.json package-lock.json` produced no output.
- Malformed license-header scan passed for changed and newly added files: no known malformed warranty-token markers were present.

## Risks And Blockers

- A production implementation needs configured Google Play publisher credentials and a real provider call to verify the token with Google Play.
- The repo does not currently expose a durable purchase-token entitlement/subscription persistence model for this route to update.
- The fail-closed `501` default is intentionally locally truthful; it avoids creating entitlements from client-supplied token strings until the provider and persistence boundaries exist.
- `OPTIONS /google-play/verify-purchase-token` exists in the xHyroM catalog but was not implemented because this was a method-scoped `POST` assignment.
