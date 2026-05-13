# POST /users/@me/billing/apple/trial-offer-signature

## Summary

Implemented the assigned method-scoped route `POST /users/@me/billing/apple/trial-offer-signature` as an authenticated compatibility endpoint that fails closed with `501` because this Spacebar instance has no Apple App Store offer-signing keys or durable Apple trial-offer state. Did not implement the xHyroM `OPTIONS` sibling or any adjacent Apple/billing routes.

## Changed Files

- `src/api/routes/users/@me/billing/apple/trial-offer-signature.ts`
- `test/routes/users-me-billing-apple-trial-offer-signature-post.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/post_users_me_billing_apple_trial_offer_signature.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained one assigned missing entry:
  - method `POST`
  - route `/users/@me/billing/apple/trial-offer-signature`
  - route name `BILLING_GENERATE_APPLE_TRIAL_OFFER_SIGNATURE`
  - source `xhyrom:data/client/routes.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` contains xHyroM `OPTIONS` and `POST` entries for the path with route name `BILLING_GENERATE_APPLE_TRIAL_OFFER_SIGNATURE`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` did not contain the assigned route before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` has no Apple trial-offer-signature entry; it only documents sibling user trial offer routes, which were intentionally left untouched.
- Public endpoint-listing searches only confirmed the path/name, not a trustworthy request or response schema, so the route does not fabricate provider-backed success payloads.

## Implementation Notes

- Added only `router.post("/")` under `src/api/routes/users/@me/billing/apple/trial-offer-signature.ts`.
- The route is bearer-authenticated through normal route middleware behavior.
- Declared `401` and `501` `APIErrorResponse` metadata; no `200` success response or request body schema is declared because there is no local Apple signing provider or durable state.
- Throws `ApiError(APPLE_TRIAL_OFFER_SIGNATURE_UNSUPPORTED_MESSAGE, 0, 501)` for authenticated requests.
- Focused tests cover auth boundary, fail-closed behavior, route metadata, generated artifacts, missing-route removal, and adjacent route non-implementation.

## Missing-Route Movement

- Worker worktree movement: `missing: 492 -> 491`, `spacebar: 688 -> 689`, `discord: 1128`.
- Main checkout acceptance base: `b478ce094`.
- Main checkout movement: `missing: 491 -> 490`, `spacebar: 689 -> 690`, `discord: 1128`.
- Main checkout generated artifacts now contain `795` testing-manifest entries and `770` generated HTTP contracts.
- Removed assigned missing entry:
  - `POST /users/@me/billing/apple/trial-offer-signature`
- Left sibling/adjacent routes untouched, including:
  - `OPTIONS /users/@me/billing/apple/trial-offer-signature`
  - `/billing/apple/apply-receipt`
  - `/billing/apple/jwt-token`
  - other `/users/@me/billing/**` offer, payment, subscription, Stripe, PayPal, and Google Play routes

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - First attempt failed because this isolated worktree had no `node_modules` and `tsgo` was not installed locally.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
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
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-billing-apple-trial-offer-signature-post.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
  - Failed only on known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/routes/users/@me/billing/apple/trial-offer-signature.ts test/routes/users-me-billing-apple-trial-offer-signature-post.test.ts`
- `git diff --check`
- `git diff -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json`

## Verification Status

- Focused route test: passed.
- `npm run build:src:tsgo`: passed after `npm ci`.
- `npm run build:test-fixtures`: passed.
- `npm run test:manifest`: passed.
- `npm run test:suite-coverage`: passed.
- Targeted ESLint: passed.
- `git diff --check`: passed.
- Package/lockfile guard: no diff.
- `npm run test:contracts`: generated contract checks passed; runtime failed on known unrelated `api:http:GET:/discovery/search` `500 !== 200`.

## Main Checkout Acceptance

- Replayed only the route, focused test, and worker progress report from the worker worktree; regenerated artifacts on current main base `b478ce094`.
- Corrected an initial replay path issue before final regeneration; only the intended `src/`, `test/`, `worker-progress/`, and generated artifact files remain in the main diff.
- Verified OpenAPI/source catalog/manifest/contracts/suite coverage include `POST /users/@me/billing/apple/trial-offer-signature` and `missing.json` no longer lists the assigned POST route.
- Main-checkout verification passed source build, schema generation, OpenAPI generation, source route catalog import, missing-route regeneration, manifest/contract/suite generation and checks, test-fixture build, focused built test `5/5`, manifest test, suite coverage test, public asset test, targeted ESLint, `git diff --check`, and package/lockfile guard.
- Full `npm run test:contracts` passed generated/static checks and failed only on the known unrelated `api:http:GET:/discovery/search` runtime `500 !== 200`.

## Risks Or Blockers

- Apple trial offer signing cannot be completed locally without a configured Apple signing key/provider and a durable model for Apple trial-offer state. Returning `501` is intentional fail-closed behavior.
- No public source in this worktree established a safe request or success response schema for this route.

## Recommended Next Tasks

- Keep Apple IAP receipt/JWT routes as separate assignments.
- Add a real Apple offer-signing provider and schema only when Spacebar has configured signing keys, entitlement/trial-offer state, and verification tests for provider-backed success behavior.
