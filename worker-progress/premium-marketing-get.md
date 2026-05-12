# GET /premium-marketing

## Summary

Implemented the assigned authenticated `GET /premium-marketing` compatibility route. The route returns a fresh empty `PremiumMarketingResponse` component list because Spacebar has no durable local premium marketing provider or private Discord client marketing state to expose.

`POST /premium-marketing` was intentionally left unimplemented.

## Changed Files

- `src/api/routes/premium-marketing.ts`
- `src/schemas/responses/PremiumMarketingResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/premium-marketing-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained both:
  - `GET /premium-marketing`, `route_name: PREMIUM_MARKETING`
  - `POST /premium-marketing`, `route_name: PREMIUM_MARKETING`
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` contains `GET`, `HEAD`, `OPTIONS`, and `POST` for `/premium-marketing`, all sourced from `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` has no `/premium-marketing` route entry.
- External source check: `https://github.com/discord-userdoccers/discord-protos/blob/master/discord_protos/premium_marketing/v1/PremiumMarketingComponentProperties.proto` documents premium marketing component properties, supporting a component-list response shape but not any local campaign/provider state.
- Nearby local behavior:
  - `src/api/routes/promotions.ts` returns `[]` until a promotion provider exists.
  - `src/api/routes/bogo-promotions.ts` returns `[]` until a BOGO promotion provider exists.
  - `src/api/routes/users/@me/outbound-promotions/codes.ts` returns `[]` without fabricating provider-backed promotion-code state.

## Route Movement

- Assigned path: `GET /premium-marketing`
- Missing methods found for the path: `GET`, `POST`
- Implemented methods: `GET`
- Intentionally untouched: `POST /premium-marketing`
- Missing-route report movement after regeneration:
  - `missing`: `579 -> 578`
  - `spacebar`: `601 -> 602`
  - `discord`: `1128`
  - Remaining `/premium-marketing` missing entry: `POST /premium-marketing`

## Behavior

- Requires bearer authentication through the normal route middleware.
- Returns `200 []` for authenticated/local test callers.
- Declares `200 PremiumMarketingResponse` and `401 APIErrorResponse`.
- Does not implement or fabricate billing, subscriptions, SKUs, purchases, entitlements, campaign eligibility, or marketing mutation state.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/premium-marketing-get.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`

## Verification Results

- Focused route test passed: 4 tests.
- Testing manifest verified: 707 entries.
- Generated contract tests verified: 682 contracts.
- Generated suite coverage verified.
- Generated HTTP contract and suite coverage tests passed: 13 tests.
- `npm run build:src:tsgo` passed.
- `npm run build:test-fixtures` passed.
- `git diff --check` passed.
- Package/lockfile guard passed: no `package.json` or `package-lock.json` diff.
- `npm run test:contracts` failed only on the known unrelated runtime issue:
  - `api:http:GET:/discovery/search should return a successful response for schema validation`
  - actual `500`, expected `200`

## Risks Or Blockers

- The xHyroM route catalog does not document request/response fields. The response type is conservative and reuses the existing `PromotionMarketingComponentResponse[]` shape, supported by Discord premium marketing component protobuf evidence.
- There is no local premium marketing provider. Returning `[]` avoids fabricated private client marketing state.
- No blocker for the assigned GET route.

## Recommended Next Tasks

- Assign `POST /premium-marketing` separately if mutation/dismissal semantics can be evidenced.
- Resolve the unrelated generated runtime contract failure for `GET /discovery/search`.
- Reconcile this worker branch with current main if the integration base has advanced after `55bd3eb75 Implement guild role connections configurations route`.

## Integration Acceptance

- Integrated on main server branch from base `d790f4880`.
- Missing-route movement: `577 -> 576`.
- Implemented-route movement: `603 -> 604`.
- Discord route count remained `1128`.
- Regenerated schemas/OpenAPI, ARE source catalog, missing-route data, testing manifest, contract tests, suite coverage, and test fixtures.
- Current-base generated counts: `1139` schemas, `494` OpenAPI paths, `709` testing manifest entries, `684` contracts, `15` suites.
- Focused route tests passed: `4/4` for `premium-marketing-get`.
- Generated checks passed: testing manifest verify, contract test check, generated HTTP contract test `9/9`, suite coverage check, generated suite coverage test `4/4`.
- `npm run lint`, `git diff --check`, and package/lockfile guard passed.
- Full `npm run test:contracts` reached the known baseline failure only: `api:http:GET:/discovery/search` returned `500` instead of `200`; analytics `query.ts` route-registration warnings remained baseline noise.
